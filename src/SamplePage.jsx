import React, { useState, useRef, useEffect } from "react";
import "./SamplePage.css";

const COLORS = [
  "#e91e63", "#ff5722", "#ffc107", "#cddc39", "#4caf50",
  "#009688", "#00bcd4", "#2196f3", "#3f51b5", "#9c27b0"
];

export default function SamplePage() {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState(null);

  const [prompt, setPrompt] = useState("");
  const [confirmedPrompt, setConfirmedPrompt] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [wordSelections, setWordSelections] = useState({});
  const [boxes, setBoxes] = useState([]);
  const [tempBox, setTempBox] = useState(null);

  const [imageUrl, setImageUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [imagePath, setImagePath] = useState(null);
  const [layerDir, setLayerDir] = useState(null);

  const drawBoxes = (ctx) => {
    // fill the background
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // draw ref boxes for gligen
    boxes.forEach((box) => {
      const index = box.index;
      const x = Math.min(box.x, box.x + box.width);
      const y = Math.min(box.y, box.y + box.height);
      const width = Math.abs(box.width);
      const height = Math.abs(box.height);

      ctx.strokeStyle = COLORS[index];
      ctx.strokeRect(x, y, width, height);
    });

    // tempBox (box yet dragging, not completed yet)
    if (tempBox) {
      const index = tempBox.index;
      const x = Math.min(tempBox.x, tempBox.x + tempBox.width);
      const y = Math.min(tempBox.y, tempBox.y + tempBox.height);
      const width = Math.abs(tempBox.width);
      const height = Math.abs(tempBox.height);

      ctx.strokeStyle = COLORS[index];
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 4]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setStartPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !startPoint) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setTempBox({
      index: activeIndex,
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y)
    });
  };

  const handleMouseUp = () => {
    if (!isDragging || !startPoint || !tempBox || tempBox.width < 8 || tempBox.height < 8) {
      setIsDragging(false);
      setStartPoint(null);
      setTempBox(null);
      setIsCreated(false);
      return;
    }

    const wordSet = wordSelections[activeIndex];
    if (!wordSet || wordSet.size === 0) {
      setIsDragging(false);
      setStartPoint(null);
      setTempBox(null);
      return;
    }

    const updatedBoxes = boxes.filter(b => b.index !== activeIndex);
    setBoxes([...updatedBoxes, tempBox]);

    setIsDragging(false);
    setStartPoint(null);
    setTempBox(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    drawBoxes(ctx);
  }, [boxes, tempBox]);

  // confirm Step 1's prompt and go to Step 2
  const handleConfirm = () => {
    setConfirmedPrompt(prompt);
    setWordSelections({});
  };
  
  const handleWordClick = (idx) => {
    setWordSelections(prev => {
      const updated = {};
      const activeKey = activeIndex.toString();

      // remove idx from all indexs
      for (const [key, set] of Object.entries(prev)) {
        updated[key] = new Set(set);
        updated[key].delete(idx);
      }

      // update index
      if (!prev[activeKey]?.has(idx)) {
        if (!updated[activeKey]) updated[activeKey] = new Set();
        updated[activeKey].add(idx);
      }

      // remove the box if there's no more selected word
      Object.entries(updated).forEach(([key, set]) => {
        if (set.size === 0) {
          setBoxes(prevBoxes => prevBoxes.filter(box => box.index.toString() !== key));
        }
      });

      return updated;
    });
  };

  const renderConfirmedPrompt = () => {
    if (!confirmedPrompt) {
      return (
        <div style={{ 
          display: "flex", flexWrap: "wrap",
          backgroundColor: "#2b2b2b", borderRadius: "24px",
          lineHeight: "1.8", width: "480px", height: "40px",
          margin: "8px", padding: "12px"
        }}></div>
      );
    }
    const words = confirmedPrompt.split(" ");
    return (
      <div style={{ 
        display: "flex", flexWrap: "wrap",
        backgroundColor: "#2b2b2b", borderRadius: "24px",
        lineHeight: "1.8", width: "480px",
        margin: "8px", padding: "12px"
      }}>
        {words.map((word, idx) => {
          const selectedColor = Object.entries(wordSelections).find(([key, set]) => set.has(idx));
          return (
            <span
              key={idx}
              onClick={() => handleWordClick(idx)}
              style={{
                backgroundColor: selectedColor ? COLORS[parseInt(selectedColor[0])] : "transparent",
                color: "#ffffff",
                fontSize: "18px",
                padding: "2px 4px",
                margin: "2px",
                borderRadius: "10px"
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  };

  const handleGenerateImage = async () => {
    if (!confirmedPrompt) return;

    const hasWordSelections = Object.values(wordSelections).some(set => set.size > 0);
    if (hasWordSelections && boxes.length === 0) {
      alert("색칠한 단어들 중에 영역이 지정되지 않은 단어가 있어요.");
      return;
    }

    // 1. make wordSet/boxes as json style
    const words = confirmedPrompt.split(" ");
    const phrases = [];
    const boxesNormalized = [];

    boxes.forEach((box) => {
      const wordSet = wordSelections[box.index];
      if (!wordSet || wordSet.size === 0) return;

      const promptWords = Array.from(wordSet)
        .sort((a, b) => a - b)
        .map(i => words[i])
        .join(" ");

      phrases.push(promptWords);
      boxesNormalized.push([
        box.x / 512,
        box.y / 512,
        (box.x + box.width) / 512,
        (box.y + box.height) / 512
      ]);
    });

    // 2. POST to backend
    try {
      setIsGenerating(true);
      setImageUrl(null);

      const res = await fetch("http://localhost:5001/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: confirmedPrompt,
          phrases: phrases,
          boxes: boxesNormalized
        }),
      });

      const result = await res.json();
      setImageUrl(`http://localhost:5001/outputs/${result.filename}`);
      setImagePath(result.filepath);
      setIsCreated(true);
    } catch (err) {
      console.error("Create Failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleExportPSD = async () => {
    if (!isCreated || boxes.length === 0) {
      alert("프롬프트 또는 캔버스 영역에 변동이 생겼습니다!");
      return;
    }

    // wordSelections → phrases
    const words = confirmedPrompt.split(" ");
    const phrases = boxes.map((box) => {
      const wordSet = wordSelections[box.index];
      if (!wordSet) return "";
      return Array.from(wordSet)
        .sort((a, b) => a - b)
        .map((i) => words[i])
        .join(" ");
    });

    // normalize boxes
    const normalizedBoxes = boxes.map((box) => {
      return [
        box.x / 512,
        box.y / 512,
        (box.x + box.width) / 512,
        (box.y + box.height) / 512,
      ];
    });

    // 1. PNG 추출
    try {
      const exportRes = await fetch("http://localhost:5001/exportpsd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imagePath,
          boxes: normalizedBoxes,
          phrases: phrases,
        })
      });

      const exportResult = await exportRes.json();
      if (!exportRes.ok) throw new Error("PNG export step failed.");

      const layerDirValue = exportResult.layer_dir;
      setLayerDir(layerDirValue);
      console.log("✅ Rough PNG Layer saved at: ", layerDirValue);

      /*
      // 2. LaMa 보강
      const lamaRes = await fetch("http://localhost:5001/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layerDir: layerDirValue })
      });

      if (!lamaRes.ok) {
        const err = await lamaRes.json();
        throw new Error(err.error || "LaMa enhancement step failed.");
      }
      const lamaDirValue = lamaRes.output_dir;
      console.log("✅ Enhanced PNG Layer saved at: ", lamaDirValue);
      */

      // 3. PSD 병합 요청
      const mergeRes = await fetch("http://localhost:5001/mergepsd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layerDir: layerDirValue }),
      });

      if (!mergeRes.ok) {
        const err = await mergeRes.json();
        throw new Error(err.error || "PSD convert step failed.");
      }

      const blob = await mergeRes.blob();
      const downloadUrl = URL.createObjectURL(blob);
      console.log("✅ PSD created successfully!");

      // 4. 다운로드 트리거
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "merged_output.psd";
      a.click();
      URL.revokeObjectURL(downloadUrl);

      alert("PSD 파일이 성공적으로 생성되었습니다!");
    } catch (err) {
      console.error("❌ PSD 생성 실패:", err);
      alert("PSD 파일 생성 중 오류가 발생했습니다.");
    }
  };

  //
  //
  // WebUI Part
  //
  //

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
    <header>
      <img src="src/illustelligence.png" style={{ height: "25%", width: "25%", textAlign: "center", marginTop: "48px" }} />
      <div style={{ margin: "-24px 24px 16px 0" }}>
        <span style={{ fontWeight: "bold", fontSize: "16px", color: "#2b2b2b" }}>한양대학교 ERICA 인공지능학과　박 유 상</span>
      </div>
    </header>
    <div className="layout-container" style={{ width: "85%", margin: "0 auto", backgroundColor: "#eeeeee" }}>
      <div className="controls">
        <p style={{ fontSize: "16px", color: "#2b2b2b", marginLeft: "6px", textAlign: "left" }}>
          <strong>1.　</strong>원하는 대상을 프롬프트로 작성해 주세요.
        </p>
        <div style={{ display: "flex", alignItems: "center" }}>
          <textarea
            placeholder="Type Prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ 
              width: "412px", height: "96px", 
              padding: "16px", marginBottom: "8px",
              fontSize: "16px", lineHeight: "1.25", resize: "none",
              boxSizing: "border-box", borderRadius: "24px", 
              backgroundColor: "#2b2b2b", color: "#f5f5f5"
            }}
          />
          <button 
            disabled={isGenerating}
            onClick={handleConfirm} 
            style={{ 
              margin: "0 auto", marginBottom: "8px",
              background: isGenerating ? "#9e9e9e" : "linear-gradient(to bottom right, #04b2d9 25%, #033e8c)",
              fontWeight: "bold", borderRadius: "16px"
            }}
          >
            ✓
          </button>
        </div>
        <hr style={{ width: "512px", border: "1.5px solid #2b2b2b", margin: "16px 0" }} />
        <p style={{ fontSize: "16px", color: "#2b2b2b", marginLeft: "6px", textAlign: "left" }}>
          <strong>2.　</strong>팔레트에서 색을 골라 단어를 색칠한 다음, 캔버스에서 영역을 지정해 주세요.
        </p>
        <div style={{ display: "flex", gap: "2px", margin: "12px 6px" }}>
          {COLORS.map((color, i) => (
            <button
              disabled={isGenerating}
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{ 
                backgroundColor: isGenerating ? "#9e9e9e" : color,
                width: "48px",
                height: activeIndex === i ? "64px" : "48px",
                borderRadius: "16px",
                display: "flex",
                justifyContent: "center",  // 수평 가운데
                alignItems: "center",      // 수직 가운데
                fontSize: activeIndex === i ? "22px" : "16px",
                fontWeight: activeIndex === i ? "bold" : "",
              }}
            >
              {i}
            </button>
          ))}
        </div>
        {renderConfirmedPrompt()}
        <hr style={{ width: "512px", border: "1.5px solid #2b2b2b", margin: "24px 0 4px 0" }} />

        <div>
          <button
            disabled={!confirmedPrompt || isGenerating}
            onClick={handleGenerateImage}
            style={{
              marginTop: "16px",
              marginRight: "8px",
              padding: "12px 24px",
              width: "160px",
              fontSize: "18px",
              borderRadius: "16px",
              background: (!confirmedPrompt || isGenerating) ? "#9e9e9e" : "linear-gradient(to bottom right, #04b2d9 25%, #033e8c)",
              color: "white",
            }}
          >
            {isGenerating ? "Generating..." : "Create Image"}
          </button>
          <button
            disabled={!isCreated || isGenerating}
            onClick={handleExportPSD}
            style={{
              marginTop: "16px",
              marginLeft: "8px",
              padding: "12px 24px",
              width: "160px",
              fontSize: "18px",
              borderRadius: "16px",
              background: (!isCreated || isGenerating) ? "#9e9e9e" : "linear-gradient(to bottom right, #04b2d9 25%, #033e8c)",
              color: "white",
            }}
          >
            Save as PSD
          </button>
        </div>
      </div>
      <div className={`canvas-area ${isGenerating ? "glow" : ""}`}>
        <canvas
          disabled={isGenerating}
          ref={canvasRef}
          width={512}
          height={512}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
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
    </div>
    </div>
  );
}
