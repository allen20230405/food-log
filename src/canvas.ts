import {
  formatNumber,
  getSummaryText,
  type DailyRecord,
  type MealRecord
} from "./domain";

export async function renderAnnotationImage(
  imageFile: File,
  meal: MealRecord,
  recordWithMeal: DailyRecord
): Promise<Blob> {
  const bitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("当前浏览器无法创建图片画布");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  drawOverlay(ctx, canvas.width, canvas.height, meal, recordWithMeal);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("标注图生成失败"));
          return;
        }
        resolve(blob);
      },
      "image/png",
      0.96
    );
  });
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  meal: MealRecord,
  recordWithMeal: DailyRecord
): void {
  const scale = width / 3072;
  const pad = Math.max(52 * scale, width * 0.035);
  const titleFont = Math.round(178 * scale);
  const bodyFont = Math.round(110 * scale);
  const smallFont = Math.round(74 * scale);
  const panelRadius = 34 * scale;

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `900 ${titleFont}px system-ui, sans-serif`;

  const titleMetrics = ctx.measureText(meal.title);
  const titleBoxWidth = Math.min(width - pad * 2, titleMetrics.width + 210 * scale);
  const titleBoxHeight = 270 * scale;
  const titleX = (width - titleBoxWidth) / 2;
  const titleY = 72 * scale;
  roundedRect(ctx, titleX, titleY, titleBoxWidth, titleBoxHeight, panelRadius);
  ctx.fillStyle = "rgb(0 0 0 / 0.55)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(meal.title, width / 2, titleY + titleBoxHeight / 2 + 4 * scale);

  const lines = [
    "名称 / 单位 / 热量 / 蛋白质",
    ...meal.items.map(
      (item) =>
        `${item.name} / ${item.amount} / ${formatNumber(item.calories)}kcal / ${formatNumber(
          item.protein
        )}g`
    )
  ];
  const lineHeight = bodyFont * 1.38;
  ctx.font = `650 ${bodyFont}px system-ui, sans-serif`;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const panelPaddingX = 112 * scale;
  const panelPaddingY = 70 * scale;
  const minPanelWidth = width * 0.74;
  const maxPanelWidth = width - pad * 2.4;
  const panelWidth = Math.min(maxPanelWidth, Math.max(minPanelWidth, textWidth + panelPaddingX * 2));
  const panelHeight = lineHeight * lines.length + panelPaddingY * 2;
  const panelX = (width - panelWidth) / 2;
  const panelY = Math.max(height * 0.42, titleY + titleBoxHeight + 320 * scale);

  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, panelRadius);
  ctx.fillStyle = "rgb(0 0 0 / 0.56)";
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  const textX = panelX + (panelWidth - textWidth) / 2;
  lines.forEach((line, index) => {
    drawFittedText(
      ctx,
      line,
      textX,
      panelY + panelPaddingY + index * lineHeight,
      panelWidth - panelPaddingX * 2,
      bodyFont
    );
  });

  const summaryBarHeight = 170 * scale;
  const summaryY = Math.min(height - 560 * scale, panelY + panelHeight + 420 * scale);
  roundedRect(ctx, pad * 1.45, summaryY, width - pad * 2.9, summaryBarHeight, 34 * scale);
  ctx.fillStyle = "#ffc400";
  ctx.fill();
  ctx.fillStyle = "#161a13";
  ctx.textAlign = "center";
  ctx.font = `900 ${smallFont * 1.16}px system-ui, sans-serif`;
  ctx.fillText(
    `汇总热量 ${formatNumber(meal.totals.calories)}kcal / 蛋白质 ${formatNumber(
      meal.totals.protein
    )}g`,
    width / 2,
    summaryY + summaryBarHeight / 2 + 2 * scale
  );

  const bottomLines = [
    `今日累计：热量 ${formatNumber(recordWithMeal.totals.calories)}kcal / 蛋白质 ${formatNumber(
      recordWithMeal.totals.protein
    )}g`,
    `目标：热量 ${formatNumber(recordWithMeal.targets.calories)}kcal / 蛋白质 ${formatNumber(
      recordWithMeal.targets.protein
    )}g`,
    `今日小结：${getSummaryText(recordWithMeal.totals, recordWithMeal.targets)}`
  ];
  const bottomLineHeight = smallFont * 1.35;
  const bottomHeight = bottomLineHeight * bottomLines.length + 84 * scale;
  const bottomY = summaryY + summaryBarHeight + 26 * scale;
  roundedRect(ctx, pad * 1.8, bottomY, width - pad * 3.6, bottomHeight, 28 * scale);
  ctx.fillStyle = "rgb(0 0 0 / 0.65)";
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = `500 ${smallFont}px system-ui, sans-serif`;
  bottomLines.forEach((line, index) => {
    drawFittedText(
      ctx,
      line,
      width / 2,
      bottomY + 46 * scale + index * bottomLineHeight,
      width - pad * 4.4,
      smallFont,
      "center"
    );
  });
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  baseSize: number,
  align: CanvasTextAlign = "left"
): void {
  const previousAlign = ctx.textAlign;
  ctx.textAlign = align;
  let size = baseSize;
  while (ctx.measureText(text).width > maxWidth && size > baseSize * 0.62) {
    size -= 2;
    ctx.font = ctx.font.replace(/\d+px/, `${Math.round(size)}px`);
  }
  ctx.fillText(text, x, y);
  ctx.textAlign = previousAlign;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
