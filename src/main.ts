import "./styles.css";
import { renderAnnotationImage } from "./canvas";
import {
  buildDailyRecord,
  createMeal,
  formatDateKey,
  formatDisplayDate,
  formatNumber,
  getSummaryText,
  markdownFileName,
  parseMealInput,
  pngFileName,
  renderDailyMarkdown,
  type DailyRecord,
  type MealRecord,
  type NutritionTargets
} from "./domain";
import { downloadBlob, downloadText } from "./download";
import { createId } from "./id";
import { createDietStore } from "./storage";

const store = createDietStore(window.localStorage);
const dateKey = formatDateKey();
let selectedImage: File | null = null;
let previewMeal: MealRecord | null = null;
let previewRecord: DailyRecord | null = null;
let previewBlob: Blob | null = null;

const dateTitle = getElement("dateTitle");
const dailyTotals = getElement("dailyTotals");
const targetCalories = getInput("targetCalories");
const targetProtein = getInput("targetProtein");
const cameraInput = getInput("cameraInput") as HTMLInputElement;
const galleryInput = getInput("galleryInput") as HTMLInputElement;
const sourcePreview = getImage("sourcePreview");
const mealInput = getTextarea("mealInput");
const previewButton = getButton("previewButton");
const saveButton = getButton("saveButton");
const message = getElement("message");
const previewPanel = getElement("previewPanel");
const annotationPreview = getImage("annotationPreview");
const mealList = getElement("mealList");
const mealCount = getElement("mealCount");

initialize();

function initialize(): void {
  const targets = store.loadTargets();
  targetCalories.value = String(targets.calories);
  targetProtein.value = String(targets.protein);
  dateTitle.textContent = `${formatDisplayDate(dateKey)} 饮食标注`;
  mealInput.value = `第一餐
酒酿 / 150g / 120 / 4
香蕉 / 1根 / 105 / 1
鸡蛋 / 2个 / 140 / 12
鱼肉 / 60g / 80 / 12`;

  targetCalories.addEventListener("input", handleTargetChange);
  targetProtein.addEventListener("input", handleTargetChange);
  cameraInput.addEventListener("change", handleImageChange);
  galleryInput.addEventListener("change", handleImageChange);
  mealInput.addEventListener("input", () => resetPreview());
  previewButton.addEventListener("click", handlePreview);
  saveButton.addEventListener("click", handleSave);

  renderSavedMeals();
}

function handleTargetChange(): void {
  const targets = readTargets();
  store.saveTargets(targets);
  const record = store.loadDailyRecord(dateKey);
  store.saveDailyRecord(buildDailyRecord(dateKey, targets, record.meals));
  resetPreview();
  renderSavedMeals();
}

function handleImageChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  selectedImage = file;
  resetPreview();
  if (!file) {
    sourcePreview.hidden = true;
    sourcePreview.removeAttribute("src");
    return;
  }
  sourcePreview.src = URL.createObjectURL(file);
  sourcePreview.hidden = false;
}

async function handlePreview(): Promise<void> {
  try {
    clearMessage();
    if (!selectedImage) {
      throw new Error("请先拍照或选择图片");
    }
    const parsed = parseMealInput(mealInput.value);
    const meal = createMeal(
      createId(),
      parsed.title,
      parsed.items,
      new Date().toISOString(),
      selectedImage.name
    );
    const record = store.loadDailyRecord(dateKey);
    const withPreview = buildDailyRecord(dateKey, readTargets(), [...record.meals, meal]);
    const blob = await renderAnnotationImage(selectedImage, meal, withPreview);

    previewMeal = meal;
    previewRecord = withPreview;
    previewBlob = blob;
    annotationPreview.src = URL.createObjectURL(blob);
    previewPanel.hidden = false;
    saveButton.disabled = false;
    showMessage(
      `预览已生成。本餐 ${formatNumber(meal.totals.calories)}kcal / ${formatNumber(
        meal.totals.protein
      )}g。`
    );
    renderSavedMeals(withPreview);
  } catch (error) {
    resetPreview(false);
    showError(error instanceof Error ? error.message : "生成预览失败");
  }
}

function handleSave(): void {
  try {
    if (!previewMeal || !previewRecord || !previewBlob) {
      throw new Error("请先生成预览");
    }
    const mealToSave = previewMeal;
    const recordToSave = previewRecord;
    const blobToSave = previewBlob;
    store.saveDailyRecord(recordToSave);
    downloadBlob(blobToSave, pngFileName(dateKey, mealToSave.title));
    window.setTimeout(() => {
      downloadText(renderDailyMarkdown(recordToSave), markdownFileName(dateKey));
    }, 250);
    showMessage("已触发下载 PNG 标注图和当天完整 MD 文件。");
    resetPreview(false);
    renderSavedMeals();
  } catch (error) {
    showError(error instanceof Error ? error.message : "保存失败");
  }
}

function renderSavedMeals(recordOverride?: DailyRecord): void {
  const record = recordOverride ?? store.loadDailyRecord(dateKey);
  dailyTotals.textContent = `${formatNumber(record.totals.calories)}kcal / ${formatNumber(
    record.totals.protein
  )}g`;
  mealCount.textContent = `${record.meals.length} 餐`;
  mealList.innerHTML = "";

  if (record.meals.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "今天还没有保存餐次。";
    mealList.appendChild(empty);
    return;
  }

  for (const meal of record.meals) {
    const row = document.createElement("div");
    row.className = "meal-row";
    const content = document.createElement("div");
    content.innerHTML = `<strong>${escapeHtml(meal.title)}</strong><small>${formatNumber(
      meal.totals.calories
    )}kcal / 蛋白质 ${formatNumber(meal.totals.protein)}g</small>`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "delete-button";
    button.textContent = "删除";
    button.addEventListener("click", () => {
      if (!window.confirm(`删除 ${meal.title}？`)) {
        return;
      }
      store.removeMeal(dateKey, meal.id);
      resetPreview();
      renderSavedMeals();
      showMessage("已删除该餐次，今日累计已更新。");
    });
    row.append(content, button);
    mealList.appendChild(row);
  }

  const summary = document.createElement("p");
  summary.className = "hint";
  summary.textContent = getSummaryText(record.totals, record.targets);
  mealList.appendChild(summary);
}

function readTargets(): NutritionTargets {
  return {
    calories: Number(targetCalories.value) || 2700,
    protein: Number(targetProtein.value) || 135
  };
}

function resetPreview(clearImagePreview = true): void {
  previewMeal = null;
  previewRecord = null;
  previewBlob = null;
  saveButton.disabled = true;
  previewPanel.hidden = true;
  annotationPreview.removeAttribute("src");
  if (clearImagePreview) {
    renderSavedMeals();
  }
}

function showMessage(text: string): void {
  message.textContent = text;
  message.classList.remove("error");
}

function showError(text: string): void {
  message.textContent = text;
  message.classList.add("error");
}

function clearMessage(): void {
  message.textContent = "";
  message.classList.remove("error");
}

function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

function getInput(id: string): HTMLInputElement {
  return getElement(id) as HTMLInputElement;
}

function getTextarea(id: string): HTMLTextAreaElement {
  return getElement(id) as HTMLTextAreaElement;
}

function getButton(id: string): HTMLButtonElement {
  return getElement(id) as HTMLButtonElement;
}

function getImage(id: string): HTMLImageElement {
  return getElement(id) as HTMLImageElement;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}
