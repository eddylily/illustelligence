from flask import Flask, request, send_file
from diffusers import StableDiffusionGLIGENPipeline
from datetime import datetime
import os
import torch
import json

app = Flask(__name__)

# load pipeline
pipe = StableDiffusionGLIGENPipeline.from_pretrained(
    "./gligen_model",
    torch_dtype=torch.float32
).to("mps")

@app.route("/generate", methods=["POST"])
def generate_image():
    data = request.json
    boxes = [item["box"] for item in data["objects"]]
    phrases = [item["prompt"] for item in data["objects"]]
    prompt = data.get("global_prompt", "an anime illustration")

    image = pipe(
        prompt=prompt,
        gligen_phrases=phrases,
        gligen_boxes=boxes,
        output_type="pil",
        num_inference_steps=25,
        guidance_scale=7.5
    ).images[0]

    # make filename based on datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"result_{timestamp}.jpg"
    saveas = os.path.join("outputs", filename)

    os.makedirs("outputs", exist_ok=True)

    # 이미지 저장
    image.save(saveas)

    return send_file(saveas, mimetype="image/png")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)