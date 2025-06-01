from flask import Flask, request, send_file, jsonify, send_from_directory
from diffusers import StableDiffusionGLIGENPipeline
from flask_cors import CORS
from datetime import datetime
import os
import torch
import json
import cv2
import shutil
import numpy as np
from PIL import Image
from segment_anything import sam_model_registry, SamPredictor
from psd_tools.api.psd_image import PSDImage
from psd_tools.constants import Compression
from psd_tools.api.layers import PixelLayer, Group
from lama_cleaner.model_manager import ModelManager
from lama_cleaner.schema import Config

app = Flask(__name__)
CORS(app)

device = "mps" if torch.backends.mps.is_available() else "cpu"
dtype = torch.float16 if device == "mps" else torch.float32

# load pipeline
pipe = StableDiffusionGLIGENPipeline.from_pretrained(
    "./gligen_model",
    torch_dtype=dtype,
    use_safetensors=False,
    safety_checker=None
).to(device)

# Load SAM model
sam = sam_model_registry["vit_b"](checkpoint="illustelligence/sam_model/sam_vit_b_01ec64.pth")
sam.to(device)
predictor = SamPredictor(sam)

lama_config = Config(
    model_name="lama",
    hf_model_id=None,
    ldm_steps=25,
    hd_strategy="crop",
    hd_strategy_crop_margin=32,
    hd_strategy_crop_trigger_size=512,
    hd_strategy_resize_limit=1024,
)

lama_model = ModelManager(
    name="lama",
    config=lama_config,
    device="mps" if torch.backends.mps.is_available() else "cpu"
)

def load_image(path):
    image = Image.open(path).convert("RGBA")
    return np.array(image)

def extract_alpha_mask(image_np):
    alpha = image_np[:, :, 3]
    return (alpha > 0).astype(np.uint8) * 255

def generate_inpaint_mask(target_alpha, other_alphas):
    combined_other = np.sum(other_alphas, axis=0)
    overlap_mask = ((combined_other > 0) & (target_alpha == 0)).astype(np.uint8) * 255
    return overlap_mask

@app.route("/outputs/<path:filename>")
def serve_output_file(filename):
    return send_from_directory("outputs", filename)

@app.route("/generate", methods=["POST"])
def generate_image():
    try:
        data = request.json
        user_prompt = data.get("prompt", "")

        # data from WebUI
        prompt = f"{user_prompt}, in an anime sketch style"
        phrases = data.get("phrases", [])
        boxes = data.get("boxes", [])

        image = pipe(
            prompt=prompt,
            gligen_phrases=phrases,
            gligen_boxes=boxes,
            gligen_scheduled_sampling_beta=1.0,
            output_type="pil",
            num_inference_steps=25
        ).images[0]

        # set filename based on datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"result_{timestamp}.png"
        output_dir = "outputs"
        os.makedirs(output_dir, exist_ok=True)
        save_path = os.path.join(output_dir, filename)

        image.save(save_path)
        print(f"Image saved successfully at: {save_path}")

        return jsonify({"filename": filename, "filepath": save_path}), 200

    except Exception as e:
        print("[ERROR]", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/exportpsd", methods=["POST"])
def export_psd():
    try:
        data = request.json
        image_path = data.get("imagePath")
        boxes = data.get("boxes", [])
        phrases = data.get("phrases", [])

        if not image_path or not os.path.exists(image_path):
            return jsonify({"error": "Image not found"}), 400

        # 원본 이미지 불러오기
        image = Image.open(image_path).convert("RGB")
        image_np = np.array(image)

        # SAM 입력 설정
        predictor.set_image(image_np)

        # 저장 디렉토리 생성
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        layer_dir = os.path.join("outputs", "layers", timestamp)
        os.makedirs(layer_dir, exist_ok=True)

        # 박스별로 PNG 마스크 생성
        for i, (phrase, box) in enumerate(zip(phrases, boxes)):
            x1 = int(box[0] * image_np.shape[1])
            y1 = int(box[1] * image_np.shape[0])
            x2 = int(box[2] * image_np.shape[1])
            y2 = int(box[3] * image_np.shape[0])
            input_box = np.array([[x1, y1, x2, y2]])

            masks, _, _ = predictor.predict(box=input_box, multimask_output=False)
            mask = masks[0].astype(np.uint8)

            # 투명 배경이 포함된 RGBA 이미지 만들기
            rgba_image = np.zeros((image_np.shape[0], image_np.shape[1], 4), dtype=np.uint8)
            rgba_image[..., :3] = image_np  # RGB 복사
            rgba_image[..., 3] = mask * 255  # 마스크 적용: 1 → 255, 0 → 0

            # 마스크 적용
            # mask_3ch = np.stack([mask] * 3, axis=-1)
            # masked_img = cv2.bitwise_and(image_np, mask_3ch)
            pil_img = Image.fromarray(rgba_image, mode="RGBA")

            # 저장
            filename = f"{i+1:02d}_{phrase.replace(' ', '_')}.png"
            layer_path = os.path.join(layer_dir, filename)
            pil_img.save(layer_path)
        
        return jsonify({
            "layer_dir": layer_dir
        }), 200

    except Exception as e:
        print("[EXPORT PNG ERROR]", str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route("/inpaint", methods=["POST"])
def inpaint_layers():
    try:
        data = request.json
        layer_dir = data.get("layerDir")

        if not layer_dir or not os.path.exists(layer_dir):
            return jsonify({"error": "Layer directory not found"}), 400

        # 준비
        png_files = sorted(f for f in os.listdir(layer_dir) if f.endswith(".png"))
        if not png_files:
            return jsonify({"error": "No PNG files found"}), 400

        output_dir = os.path.join(layer_dir, "lama_fixed")
        os.makedirs(output_dir, exist_ok=True)

        # 전체 이미지 로드
        all_images = {f: load_image(os.path.join(layer_dir, f)) for f in png_files}
        all_alphas = {f: extract_alpha_mask(img) for f, img in all_images.items()}

        for filename in png_files:
            target_img = all_images[filename]
            target_alpha = all_alphas[filename]

            # 나머지 알파 채널만
            other_alphas = [alpha for f, alpha in all_alphas.items() if f != filename]
            if not other_alphas:
                print(f"⏭️ Skipping {filename}: no others")
                continue

            mask = generate_inpaint_mask(target_alpha, np.stack(other_alphas, axis=0))

            rgb = target_img[:, :, :3]
            result_np = lama_model(
                image=rgb,
                mask=mask,
                config=lama_config
            )

            # 알파 채널 보존 + 마스크 영역 보완
            final_alpha = np.where(mask > 0, 255, target_alpha)
            result_pil = Image.fromarray(result_np.astype(np.uint8))
            result_pil.putalpha(Image.fromarray(final_alpha.astype(np.uint8)))

            output_path = os.path.join(output_dir, filename)
            result_pil.save(output_path)
            print(f"✅ Inpainted {filename} saved to {output_path}")

        return jsonify({
            "message": "All layers inpainted successfully.",
            "output_dir": output_dir,
            "files": os.listdir(output_dir)
        })

    except Exception as e:
        print("[INPAINT ERROR]", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/mergepsd", methods=["POST"])
def merge_psd():
    try:
        data = request.json
        layer_dir = data.get("layerDir")
        print(f"✅ layer_dir = {layer_dir}")

        if not layer_dir or not os.path.exists(layer_dir):
            return jsonify({"error": "Layer directory not found"}), 400

        png_files = sorted(os.listdir(layer_dir))
        if not png_files:
            return jsonify({"error": "No valid PNG layers found."}), 400

        # PSD baseline
        # copied_psd = copy_psd_file()
        # psd = PSDImage.open(copied_psd)
        psd = PSDImage.new(mode="RGBA", size=(512, 512))
        # Group.new("Exported", open_folder=True, parent=None)

        for file in png_files:
            image_path = os.path.join(layer_dir, file)
            pil_image = Image.open(image_path).convert("RGBA")
            layer_name = os.path.splitext(file)[0]
            pixel_layer = PixelLayer.frompil(pil_image, psd, layer_name, top=0, left=0)
            psd.append(pixel_layer)
            print(f"✅ Append Complete!")
        
        psd_output_dir = "outputs/psd"
        os.makedirs(psd_output_dir, exist_ok=True)
        psd_filename = f"merged_{datetime.now().strftime('%Y%m%d_%H%M%S')}.psd"
        psd_path = os.path.join(psd_output_dir, psd_filename)
        psd.save(psd_path)

        print(f"✅ Merged PSD saved: {psd_path}")
        return send_file(psd_path, mimetype="application/octet-stream")

    except Exception as e:
        print("[MERGE PSD ERROR]", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)