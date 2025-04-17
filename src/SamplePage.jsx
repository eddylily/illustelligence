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

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [tempBox, setTempBox] = useState(null);

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
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    boxes.forEach((box) => {
      ctx.strokeStyle = colors[box.id % colors.length];
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    });

    if (tempBox) {
      ctx.strokeStyle = colors[tempBox.id % colors.length];
      ctx.strokeRect(tempBox.x, tempBox.y, tempBox.width, tempBox.height);
    }
  };

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
  
    setIsGenerating(true);
    setGeneratedImages({});
  
    for (const box of validBoxes) {
      const promptText = prompts.find(p => p.id === box.id)?.text || "";
  
      try {
        const res = await fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            width: box.width,
            height: box.height,
            steps: 30
          })
        });
  
        const data = await res.json();
        const imageUrl = `data:image/png;base64,${data.images[0]}`;
  
        setGeneratedImages(prev => ({
          ...prev,
          [box.id]: imageUrl
        }));
      } catch (error) {
        console.error("이미지 생성 실패: ", error);
      }
    }
  
    setIsGenerating(false);
  };

  /*
  const handleGenerateImage = () => {
    const targetBox = boxes[0];
    const promptText = prompts.find(p => p.id === targetBox.id)?.text || "";
  
    fetch("http://127.0.0.1:7860/sdapi/v1/txt2img", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: promptText,
        width: 512,
        height: 512,
        steps: 20
      })
    })
      .then(res => res.json())
      .then(data => {
        const base64Image = data.images[0];
        const imageUrl = `data:image/png;base64,${base64Image}`;
        const img = new Image();
        img.src = imageUrl;
        img.style.width = "256px";
        img.style.marginTop = "1rem";
        document.body.appendChild(img);
      });
  };
  */

  return (
    <>
    <div className="layout-container" style={{ backgroundColor: "#f5f5f5" }}>
      {/* Canvas */}
      <div className={`canvas-area ${isGenerating ? "glow" : "glow"}`}>
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
              key={p.id}
              className={`prompt-box flex flex-col transition-all ${isSelected ? "active" : ""}`}
              style={{ backgroundColor: "transparent", color: "#2b2b2b", 
                width: "26rem", padding: "0.5rem", 
                marginBottom: "0.75rem"
              }}
            > {/* Edge of the boxes */}
              {/* Text Input */}
              <input
                className="items-center text-lg rounded-full border-none outline-none"
                style={{ backgroundColor: colorpastel, color: "#2b2b2b", 
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
                className={`self-start items-center text-sm rounded-full transition-colors duration-200 text-white border-none outline-none`}
                style={{ 
                  backgroundColor: color, color: "#f5f5f5", 
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

        <button
          className="items-center mt-4 bg-white text-black px-4 py-2 rounded shadow hover:bg-gray-200"
          style={{ 
            backgroundColor: "#2b2b2b", color: "#f5f5f5", 
            margin: "0 auto", marginTop: "1.5rem", 
            width: "13rem", height: "3rem"
          }}
          onClick={handleGenerate}
        >
          Create Image
        </button>
      </div>
    </div>

    <div style={{ width: "100%", marginTop: "0.5rem", marginLeft: "2.5rem", textAlign: "left" }}>
      <p style={{ color: "#2b2b2b", fontSize: "1rem" }}>
        원하는 사물을 텍스트로 입력한 뒤, Draw 버튼을 눌러 캔버스에 드래그하여 위치와 크기를 지정하세요.
      </p>
    </div>
    </>
  );
}
