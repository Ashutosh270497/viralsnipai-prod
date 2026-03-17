import { format } from "date-fns";
import { GeneratedScript } from "@/lib/types/script";

/**
 * Export script as plain text file
 */
export function exportAsText(script: GeneratedScript) {
  const content = `${script.title}
${'='.repeat(script.title.length)}

Generated: ${format(new Date(script.createdAt), "MMMM d, yyyy 'at' h:mm a")}
Duration: ${formatDuration(script.durationEstimate || 0)}

${script.hook ? `HOOK (0:00-0:15)\n${'-'.repeat(50)}\n${script.hook}\n\n` : ''}${script.intro ? `INTRODUCTION\n${'-'.repeat(50)}\n${script.intro}\n\n` : ''}${script.mainContent ? `MAIN CONTENT\n${'-'.repeat(50)}\n${script.mainContent}\n\n` : ''}${script.conclusion ? `CONCLUSION\n${'-'.repeat(50)}\n${script.conclusion}\n\n` : ''}${script.cta ? `CALL TO ACTION\n${'-'.repeat(50)}\n${script.cta}\n\n` : ''}
---

${script.retentionTips && script.retentionTips.length > 0 ? `RETENTION TIPS:\n${(Array.isArray(script.retentionTips) ? script.retentionTips : JSON.parse(script.retentionTips as any)).map((tip: string) => `• ${tip}`).join('\n')}\n` : ''}
Generated with ViralSnipAI Script Generator
`;

  downloadTextFile(content, `${sanitizeFilename(script.title)}.txt`);
}

/**
 * Export script in teleprompter format (large text, easy reading)
 */
export function exportAsTeleprompter(script: GeneratedScript) {
  // Create a new window with teleprompter-friendly formatting
  const teleprompterWindow = window.open("", "_blank");
  if (!teleprompterWindow) return;

  const fullScript = [
    script.hook,
    script.intro,
    script.mainContent,
    script.conclusion,
    script.cta,
  ].filter(Boolean).join('\n\n');

  // Remove visual cues for cleaner reading
  const cleanScript = fullScript.replace(/\[SHOW:.*?\]|\[B-ROLL:.*?\]|\[GRAPHICS:.*?\]|\[.*?\]/g, '');

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Teleprompter - ${script.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background: #000;
            color: #fff;
            font-family: 'Arial', sans-serif;
            overflow-x: hidden;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 60vh 20px;
          }
          .title {
            text-align: center;
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 3rem;
            color: #4CAF50;
          }
          .script {
            font-size: 2.5rem;
            line-height: 1.8;
            text-align: center;
            white-space: pre-wrap;
          }
          .controls {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 15px 30px;
            border-radius: 50px;
            display: flex;
            gap: 20px;
            z-index: 1000;
          }
          .controls button {
            background: #4CAF50;
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: bold;
            transition: background 0.3s;
          }
          .controls button:hover {
            background: #45a049;
          }
          .controls button:disabled {
            background: #666;
            cursor: not-allowed;
          }
          .speed-control {
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
          }
          .speed-control input {
            width: 100px;
          }
          .mirror {
            transform: scaleX(-1);
          }
          @media (max-width: 768px) {
            .script {
              font-size: 1.5rem;
            }
            .controls {
              flex-direction: column;
              gap: 10px;
              padding: 10px 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container" id="container">
          <div class="title">${script.title}</div>
          <div class="script" id="script">${cleanScript}</div>
        </div>

        <div class="controls">
          <button onclick="startScroll()" id="startBtn">Start</button>
          <button onclick="pauseScroll()" id="pauseBtn" disabled>Pause</button>
          <button onclick="resetScroll()" id="resetBtn">Reset</button>
          <div class="speed-control">
            <label>Speed:</label>
            <input type="range" id="speed" min="0.5" max="3" step="0.1" value="1" oninput="updateSpeed(this.value)">
            <span id="speedValue">1x</span>
          </div>
          <button onclick="toggleMirror()">Mirror</button>
        </div>

        <script>
          let scrolling = false;
          let scrollSpeed = 1;
          let scrollInterval;

          function startScroll() {
            scrolling = true;
            document.getElementById('startBtn').disabled = true;
            document.getElementById('pauseBtn').disabled = false;

            scrollInterval = setInterval(() => {
              window.scrollBy(0, scrollSpeed);
            }, 16); // ~60fps
          }

          function pauseScroll() {
            scrolling = false;
            clearInterval(scrollInterval);
            document.getElementById('startBtn').disabled = false;
            document.getElementById('pauseBtn').disabled = true;
          }

          function resetScroll() {
            pauseScroll();
            window.scrollTo(0, 0);
          }

          function updateSpeed(value) {
            scrollSpeed = parseFloat(value);
            document.getElementById('speedValue').textContent = value + 'x';
          }

          function toggleMirror() {
            document.getElementById('script').classList.toggle('mirror');
          }

          // Keyboard controls
          document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
              e.preventDefault();
              if (scrolling) {
                pauseScroll();
              } else {
                startScroll();
              }
            } else if (e.code === 'KeyR') {
              e.preventDefault();
              resetScroll();
            } else if (e.code === 'ArrowUp') {
              e.preventDefault();
              const speedSlider = document.getElementById('speed');
              speedSlider.value = Math.min(3, parseFloat(speedSlider.value) + 0.1).toFixed(1);
              updateSpeed(speedSlider.value);
            } else if (e.code === 'ArrowDown') {
              e.preventDefault();
              const speedSlider = document.getElementById('speed');
              speedSlider.value = Math.max(0.5, parseFloat(speedSlider.value) - 0.1).toFixed(1);
              updateSpeed(speedSlider.value);
            }
          });
        </script>
      </body>
    </html>
  `;

  teleprompterWindow.document.write(content);
  teleprompterWindow.document.close();
}

/**
 * Export script as PDF (browser print)
 */
export function exportAsPDF(script: GeneratedScript) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${script.title} - Script</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
          .section { margin: 30px 0; }
          .section-title { font-weight: bold; color: #0066cc; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
          .timestamp { color: #999; font-size: 12px; }
          .visual-cue { background: #f0f0f0; padding: 5px 10px; margin: 10px 0; font-style: italic; font-size: 12px; }
          .tips { background: #f9f9f9; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; }
          .tips h3 { margin-top: 0; font-size: 14px; }
          .tips ul { margin: 10px 0; padding-left: 20px; }
          .tips li { margin: 5px 0; font-size: 12px; }
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${script.title}</h1>
        <div class="meta">
          Generated: ${format(new Date(script.createdAt), "MMMM d, yyyy 'at' h:mm a")}<br>
          Duration: ${formatDuration(script.durationEstimate || 0)}
        </div>

        ${script.hook ? `<div class="section"><div class="section-title">Hook (0:00-0:15)</div><p>${script.hook.replace(/\n/g, '<br>')}</p></div>` : ''}

        ${script.intro ? `<div class="section"><div class="section-title">Introduction</div><p>${script.intro.replace(/\n/g, '<br>')}</p></div>` : ''}

        ${script.mainContent ? `<div class="section"><div class="section-title">Main Content</div><p>${script.mainContent.replace(/\n/g, '<br>')}</p></div>` : ''}

        ${script.conclusion ? `<div class="section"><div class="section-title">Conclusion</div><p>${script.conclusion.replace(/\n/g, '<br>')}</p></div>` : ''}

        ${script.cta ? `<div class="section"><div class="section-title">Call to Action</div><p>${script.cta.replace(/\n/g, '<br>')}</p></div>` : ''}

        ${script.retentionTips && script.retentionTips.length > 0 ? `
          <div class="tips">
            <h3>Retention Tips</h3>
            <ul>
              ${(Array.isArray(script.retentionTips) ? script.retentionTips : JSON.parse(script.retentionTips as any)).map((tip: string) => `<li>${tip}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="no-print" style="margin-top: 40px; text-align: center;">
          <button onclick="window.print()" style="background: #0066cc; color: white; border: none; padding: 10px 30px; border-radius: 5px; cursor: pointer; font-size: 16px;">Print / Save as PDF</button>
        </div>

        <script>
          // Auto-print dialog
          setTimeout(() => window.print(), 500);
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(content);
  printWindow.document.close();
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .substring(0, 50);
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Export script to Google Docs
 * Opens Google Docs with pre-filled content
 */
export function exportToGoogleDocs(script: GeneratedScript) {
  const content = `${script.title}
${'='.repeat(script.title.length)}

Generated: ${format(new Date(script.createdAt), "MMMM d, yyyy 'at' h:mm a")}
Duration: ${formatDuration(script.durationEstimate || 0)}

${script.hook ? `HOOK (0:00-0:15)\n${'-'.repeat(50)}\n${script.hook}\n\n` : ''}${script.intro ? `INTRODUCTION\n${'-'.repeat(50)}\n${script.intro}\n\n` : ''}${script.mainContent ? `MAIN CONTENT\n${'-'.repeat(50)}\n${script.mainContent}\n\n` : ''}${script.conclusion ? `CONCLUSION\n${'-'.repeat(50)}\n${script.conclusion}\n\n` : ''}${script.cta ? `CALL TO ACTION\n${'-'.repeat(50)}\n${script.cta}\n\n` : ''}
---

${script.retentionTips && script.retentionTips.length > 0 ? `RETENTION TIPS:\n${(Array.isArray(script.retentionTips) ? script.retentionTips : JSON.parse(script.retentionTips as any)).map((tip: string) => `• ${tip}`).join('\n')}\n` : ''}
Generated with ViralSnipAI Script Generator
`;

  // Create a temporary form to submit to Google Docs
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://docs.google.com/document/create';
  form.target = '_blank';

  const titleInput = document.createElement('input');
  titleInput.type = 'hidden';
  titleInput.name = 'title';
  titleInput.value = script.title;
  form.appendChild(titleInput);

  const contentInput = document.createElement('input');
  contentInput.type = 'hidden';
  contentInput.name = 'body';
  contentInput.value = content;
  form.appendChild(contentInput);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}
