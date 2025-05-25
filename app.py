from flask import Flask, request, send_file, jsonify
from diffusers import StableDiffusionGLIGENPipeline
from flask_cors import CORS
from datetime import datetime
import os
import torch

app = Flask(__name__)
CORS(app)

device = "mps" if torch.backends.mps.is_available() else "cpu"

# load pipeline
pipe = StableDiffusionGLIGENPipeline.from_pretrained(
    "./gligen_model",
    torch_dtype=torch.float32,
    use_safetensors=False
).to(device)

@app.route("/generate", methods=["POST"])
def generate_image():
    try:
        data = request.json

        # data from WebUI
        objects = data.get("objects", [])
        prompt = data.get("global_prompt", "an anime illustration")

        # extract box and prompt
        boxes = [obj["box"] for obj in objects]
        phrases = [obj["prompt"] for obj in objects]

        image = pipe(
            prompt=prompt,
            gligen_phrases=phrases,
            gligen_boxes=boxes,
            gligen_scheduled_sampling_beta=1.0,
            output_type="pil",
            num_inference_steps=30
        ).images[0]

        # set filename based on datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"result_{timestamp}.png"
        output_dir = "outputs"
        os.makedirs(output_dir, exist_ok=True)
        save_path = os.path.join(output_dir, filename)

        image.save(save_path)
        print(f"Image saved successfully at: {save_path}")

        return send_file(save_path, mimetype="image/png")

    except Exception as e:
        print("[ERROR]", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)