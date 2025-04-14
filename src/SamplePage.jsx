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
    ctx.fillStyle = "white";
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
    ctx.fillStyle = "white";
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

  return (
    <>
    <div className="layout-container" style={{ backgroundColor: "#f5f5f5" }}>
      {/* Canvas */}
      <div className="canvas-area">
      <canvas
        ref={canvasRef}
        width={512}
        height={512}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className="border shadow rounded"
        style={{ border: "4px solid #2b2b2b", marginBottom: "0.5rem" }}
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
              style={{ backgroundColor: "transparent", color: "#2b2b2b", width: "26rem", padding: "0.5rem", marginBottom: "0.75rem" }}
            > {/* Edge of the boxes */}
              {/* Text Input */}
              <input
                className="items-center text-lg rounded-full border-none outline-none"
                style={{ backgroundColor: colorpastel, color: "#2b2b2b", fontSize: "0.75rem", width: "16rem", height: "1.33rem", marginTop: "0.33rem", marginBottom: "0.33rem" }}
                placeholder={`Prompt ${p.id}`}
                value={p.text}
                onChange={e => handlePromptChange(p.id, e.target.value)}
              />
              {/* Draw Button */}
              <button
                className={`self-start items-center text-sm rounded-full transition-colors duration-200 text-white border-none outline-none`}
                style={{ backgroundColor: color, color: "#f5f5f5", textAlign: "center", marginLeft: "1em", marginTop: "0.2rem", marginBottom: "0.2rem", width: "5em", height: "2.5rem" }}
                onClick={() => setDrawingPromptId(p.id)}
              >
              Draw
              </button>
            </div>
          );
        })}

        <button
          className="items-center mt-4 bg-white text-black px-4 py-2 rounded shadow hover:bg-gray-200"
          style={{ backgroundColor: "#2b2b2b", color: "#f5f5f5", margin: "0 auto", marginTop: "1.5rem", width: "13rem", height: "3rem" }}
          onClick={() => alert("이미지 생성 기능이 아직 구현되지 않았습니다.")}
        >
          이미지 생성하기
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
