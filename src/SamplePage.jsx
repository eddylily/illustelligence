import React, { useState, useRef, useEffect } from "react";
import './SamplePage.css';

export default function SamplePage() {
  const [prompts, setPrompts] = useState([
    { id: 1, text: "" },
    { id: 2, text: "" },
    { id: 3, text: "" },
    { id: 4, text: "" },
    { id: 5, text: "" }
  ]);
  const [drawingPromptId, setDrawingPromptId] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [generatedImages, setGeneratedImages] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isAbleRetry, setIsAbleRetry] = useState(false);

  const canvasRef = useRef(null);
  const controlNetCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [tempBox, setTempBox] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);

  const colors = [
    "#e91e63", "#ffa000", "#8bc34a", "#00bcd4", "#3f51b5"
  ];
  const colorsPastel = [
    "#f8bbd0", "#ffecb3", "#dcedc8", "#b2ebf2", "#c5cae9"
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    renderBoxes(ctx);
  }, [boxes, tempBox]);

  const handlePromptChange = (id, value) => {
    setPrompts(prompts.map(p => (p.id === id ? { ...p, text: value } : p)));
  };

  /*
  const generatePromptText = () => {
    return prompts
      .filter(p => p.text.trim() && boxes.some(b => b.id === p.id))
      .map(p => {
        const box = boxes.find(b => b.id === p.id);
        return `${p.text} located at (${box.x}, ${box.y}) with size ${box.width}x${box.height}`;
      })
      .join(", ");
  };
  */

  // normalize the coordinate and size of the box
  function normalizeBox(box) {
    const topLeftX = Math.min(box.x, box.x + box.width);
    const topLeftY = Math.min(box.y, box.y + box.height);
    const bottomRightX = Math.max(box.x, box.x + box.width);
    const bottomRightY = Math.max(box.y, box.y + box.height);

    const centerX = (topLeftX + bottomRightX) / 2.0;
    const centerY = (topLeftY + bottomRightY) / 2.0;
    const normalizedWidth = Math.abs(box.width);
    const normalizedHeight = Math.abs(box.height);
  
    return {
      x: centerX, y: centerY,
      width: normalizedWidth, height: normalizedHeight,
      id: box.id
    };
  }

  // translate coordinate into natural lang
  function getNaturalPosition(x, y) {
    if (y < 192) return x < 192 ? "top-left corner" : x > 320 ? "top-right corner" : "top-center";
    if (y > 320) return x < 192 ? "bottom-left corner" : x > 320 ? "bottom-right corner" : "bottom-center";
    return x < 192 ? "middle-left" : x > 320 ? "middle-right" : "center";
  }

  // translate size into natural lang
  /*
  function getNaturalSize(width, height) {
    const area = width * height;
    if (area < 10000) return "small in size";
    if (area > 25600) return "large in size";
    return "medium in size";
  }

  // combine
  function combineNatural(promptText, box) {
    const position = getNaturalPosition(box.x, box.y);
    const size = getNaturalSize(box.width, box.height);
    return `${promptText}, placed in the ${position}, ${size}. `;
  }
  */

  // final prompt
  function generatePromptText() {
    const validPrompts = prompts
    .filter(p => p.text.trim() && boxes.some(b => b.id === p.id));

    return validPrompts
    .map(p => {
      const box = normalizeBox(boxes.find(b => b.id === p.id));
      return `${p.id}: ${p.text.trim()} located in the ${getNaturalPosition(box.x, box.y)}`
    })
    .join("\n");

    /*
    return prompts
      .filter(p => p.text.trim() && boxes.some(b => b.id === p.id))
      .map(p => {
        const boxOrigin = boxes.find(b => b.id === p.id);
        const box = normalizeBox(boxOrigin);
        return `Object ${p.id}: ${p.text.trim()} placed on the ${getNaturalPosition(box.x, box.y)}`;
        // return combineNatural(p.text.trim(), box);
      })
      .join(", ");
    */
  }

  const drawControlNetCanvas = () => {
    const canvas = controlNetCanvasRef.current;
    const ctx = canvas.getContext("2d");

    // fill the background
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // draw ref img for controlNet
    boxes.forEach((box) => {
      const x = Math.min(box.x, box.x + box.width);
      const y = Math.min(box.y, box.y + box.height);
      const width = Math.abs(box.width);
      const height = Math.abs(box.height);
      ctx.fillStyle = colors[box.id % colors.length];
      ctx.fillRect(x, y, width, height);

      ctx.fillStyle = "#000000";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${box.id}`, x + width / 2, y + height / 2);
      //ctx.strokeStyle = "#ffffff";
      //ctx.lineWidth = 4;
      //ctx.strokeRect(x, y, width, height);

      /*
      const promptText = prompts.find(p => p.id === box.id)?.text.trim();
      if (promptText) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(promptText, x + width / 2, y + height / 2);
      }
      */
    });
  };

  /*
  const getControlImageBase64 = () => {
    drawControlNetCanvas();
    const dataUrl = controlNetCanvasRef.current.toDataURL("image/png");
    return dataUrl.split(",")[1]; // return base64 only
  };
  */

  const handleMouseDown = (e) => {
    if (!drawingPromptId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDrawing(true);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPos) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const newTempBox = {
      id: drawingPromptId,
      prompt: prompts.find(p => p.id === drawingPromptId).text,
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      width: Math.abs(currentX - startPos.x),
      height: Math.abs(currentY - startPos.y),
    };
    setTempBox(newTempBox);
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !startPos || !tempBox) return;

    const updatedBoxes = boxes.filter(b => b.id !== drawingPromptId);
    setBoxes([...updatedBoxes, tempBox]);

    setIsDrawing(false);
    setStartPos(null);
    setTempBox(null);
  };

  const renderBoxes = (ctx) => {
    // fill the background
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // draw ref img for controlNet
    boxes.forEach((box) => {
      const x = Math.min(box.x, box.x + box.width);
      const y = Math.min(box.y, box.y + box.height);
      const width = Math.abs(box.width);
      const height = Math.abs(box.height);
      ctx.strokeStyle = colors[box.id % colors.length];
      ctx.strokeRect(x, y, width, height);
    });

    // tempBox (box yet dragging, not completed yet)
    if (tempBox) {
      const x = Math.min(tempBox.x, tempBox.x + tempBox.width);
      const y = Math.min(tempBox.y, tempBox.y + tempBox.height);
      const width = Math.abs(tempBox.width);
      const height = Math.abs(tempBox.height);

      ctx.strokeStyle = colors[tempBox.id % colors.length];
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }
  };

  // 
  // Core method
  //
  const handleGenerate = async () => {
    // If there are any prompts
    const filledPrompts = prompts.filter(p => p.text.trim() !== "");
  
    // If there's no prompt
    if (filledPrompts.length === 0) {
      alert("하나 이상의 프롬프트를 입력하셔야 합니다.");
      return;
    }
  
    // Find prompts without square
    const missingBoxes = filledPrompts.filter(p => {
      return !boxes.some(b => b.id === p.id);
    });
  
    if (missingBoxes.length > 0) {
      alert("입력하신 모든 프롬프트에 대하여 영역을 지정해 주세요.\nDraw 버튼을 누르면 영역을 지정하실 수 있습니다.");
      return;
    }
  
    // Satisfied
    const validBoxes = boxes.filter(box => {
      const prompt = prompts.find(p => p.id === box.id);
      return prompt && prompt.text.trim() !== "";
    });

    setIsAbleRetry(false);
    drawControlNetCanvas();
    setIsGenerating(true);
    setIsDisabled(true);
    setDrawingPromptId(null);
    setGeneratedImages({});
  
    // prompts reformed
    const promptText = generatePromptText();
    const imgBase64 = controlNetCanvasRef.current.toDataURL("image/png").split(",")[1]

    // v1-5-pruned-emaonly.safetensors [6ce0161689]
    // edxnya_1152.safetensors [65d24d071c]
    // control_v11f1e_sd15_tile [a371b31b]
    // control_v11p_sd15_seg [e1f51eb9]
    try {
      const res = await fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          width: 512,
          height: 512,
          steps: 30,
          alwayson_scripts: {
            controlnet: {
              args: [
                {
                  image: imgBase64,
                  module: "none",
                  model: "control_v11p_sd15_seg [e1f51eb9]",
                  weight: 1.0,
                  resize_mode: "Resize and Fill",
                  control_mode: "Balanced"
                }
              ]
            }
          }
        })
      });

      console.log(promptText);
      const data = await res.json();
      setImageUrl(`data:image/png;base64,${data.images[0]}`);
      setGeneratedImages({ full: imageUrl });

    } catch (error) {
      alert("이미지 생성에 실패했습니다.\n", error);
      console.error("Generation Failed: ", error);
      setIsGenerating(false);
      setIsDisabled(false);
      return;
    }
    setIsGenerating(false);
    setIsAbleRetry(true);
  };

  return (
    <>
    <div className="layout-container" style={{ backgroundColor: "#f5f5f5" }}>
      {/* Canvas */}
      <div className={`canvas-area ${isGenerating ? "glow" : ""}`}>
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="border shadow rounded"
          style={{ border: "4px solid #2b2b2b" }}
        />
        
        {imageUrl && (
          <img src={imageUrl} alt="Generated"
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "512px", height: "512px",
            zIndex: 2, pointerEvents: "none"
          }}
          />
        )}
      </div>

      {/* Prompt Boxs */}
      <div className="prompt-area">
        {/* loop */}
        {prompts.map(p => {
          const isSelected = drawingPromptId === p.id;
          const color = colors[p.id % colors.length];
          const colorpastel = colorsPastel[p.id % colors.length];


          return (
            <div
              disabled={isGenerating}
              key={p.id}
              className={`prompt-box flex flex-col transition-all ${isSelected ? "active" : ""}`}
              style={{ backgroundColor: "transparent", color: "#2b2b2b", 
                width: "26rem", padding: "0.5rem", 
                marginBottom: "0.75rem"
              }}
            > {/* Edge of the boxes */}
              {/* Text Input */}
              <input
                readOnly={isDisabled}
                className="items-center text-lg rounded-full border-none outline-none"
                style={{ backgroundColor: isDisabled ? "#e0e0e0" : colorpastel, 
                  color: "#2b2b2b", 
                  fontSize: "0.75rem", 
                  width: "16rem", height: "1.33rem", 
                  marginTop: "0.33rem", marginBottom: "0.33rem"
                }}
                placeholder={`Prompt ${p.id}`}
                value={p.text}
                onChange={e => handlePromptChange(p.id, e.target.value)}
              />
              {/* Draw Button */}
              <button
                disabled={isDisabled}
                className={`self-start items-center text-sm rounded-full transition-colors duration-200 text-white border-none outline-none`}
                style={{ 
                  backgroundColor: isDisabled ? "#9e9e9e" : color, 
                  color: "#f5f5f5", 
                  textAlign: "center", 
                  marginLeft: "1em", marginTop: "0.2rem", marginBottom: "0.2rem", 
                  width: "5em", height: "2.5rem"
                }}
                onClick={() => setDrawingPromptId(p.id)}
              >
              Draw
              </button>
            </div>
          );
        })}

        {!isAbleRetry && (
          <button
            disabled={isDisabled}
            className="items-center mt-4 bg-white text-black px-4 py-2 rounded shadow hover:bg-gray-200"
            style={{ 
              backgroundColor: isDisabled ? "#9e9e9e" : "#2b2b2b", 
              color: "#f5f5f5", 
              margin: "0 auto", marginTop: "1.5rem", 
              width: "13rem", height: "3rem"
            }}
            onClick={handleGenerate}
          >
            Create Image
          </button>
        )}
        {isAbleRetry && (
          <button
            disabled={!isAbleRetry}
            className="items-center mt-4 bg-white text-black px-4 py-2 rounded shadow hover:bg-gray-200"
            style={{ 
              backgroundColor: isAbleRetry ? "#2b2b2b" : "#9e9e9e", 
              color: "#f5f5f5",
              margin: "0 auto", marginTop: "1.5rem",
              width: "13rem", height: "3rem"
            }}
            onClick={() => {
              setImageUrl();
              setGeneratedImages({});
              setIsDisabled(false);
              setIsAbleRetry(false);
            }}
          >
            Back
          </button>
        )}

      </div>
    </div>

    <div style={{ width: "100%", marginTop: "0.5rem", marginLeft: "2.5rem", textAlign: "left" }}>
      <p style={{ color: "#2b2b2b", fontSize: "1rem" }}>
        원하는 사물을 텍스트로 입력한 뒤, Draw 버튼을 눌러 캔버스에 드래그하여 위치와 크기를 지정하세요.
      </p>
    </div>
    <canvas
      ref={controlNetCanvasRef}
      width={512}
      height={512}
      style={{ display: "none" }}
    />
    </>
  );
}
