export type NutritionTargets = {
  calories: number;
  protein: number;
};

export type FoodItem = {
  name: string;
  amount: string;
  calories: number;
  protein: number;
};

export type ParsedMealInput = {
  title: string;
  items: FoodItem[];
};

export type MealRecord = ParsedMealInput & {
  id: string;
  createdAt: string;
  imageFileName?: string;
  totals: NutritionTargets;
};

export type DailyRecord = {
  date: string;
  targets: NutritionTargets;
  meals: MealRecord[];
  totals: NutritionTargets;
};

export function parseMealInput(input: string): ParsedMealInput {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines[0];
  if (!title) {
    throw new Error("请填写餐次标题");
  }

  const items = lines.slice(1).map((line, index) => {
    const rowNumber = index + 2;
    const parts = line.split("/").map((part) => part.trim());
    if (parts.length !== 4 || parts.some((part) => part.length === 0)) {
      throw new Error(`第 ${rowNumber} 行需要 4 个字段`);
    }

    const calories = Number(parts[2]);
    if (!Number.isFinite(calories)) {
      throw new Error(`第 ${rowNumber} 行的热量必须是数字`);
    }

    const protein = Number(parts[3]);
    if (!Number.isFinite(protein)) {
      throw new Error(`第 ${rowNumber} 行的蛋白质必须是数字`);
    }

    return {
      name: parts[0],
      amount: parts[1],
      calories,
      protein
    };
  });

  if (items.length === 0) {
    throw new Error("请至少填写一个食物条目");
  }

  return { title, items };
}

export function createMeal(
  id: string,
  title: string,
  items: FoodItem[],
  createdAt = new Date().toISOString(),
  imageFileName?: string
): MealRecord {
  return {
    id,
    title,
    items,
    createdAt,
    imageFileName,
    totals: sumItems(items)
  };
}

export function buildDailyRecord(
  date: string,
  targets: NutritionTargets,
  meals: MealRecord[]
): DailyRecord {
  const sortedMeals = [...meals].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    date,
    targets,
    meals: sortedMeals,
    totals: sumItems(sortedMeals.flatMap((meal) => meal.items))
  };
}

export function deleteMeal(record: DailyRecord, mealId: string): DailyRecord {
  return buildDailyRecord(
    record.date,
    record.targets,
    record.meals.filter((meal) => meal.id !== mealId)
  );
}

export function formatDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function formatDisplayDate(dateKey: string): string {
  return `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
}

export function safeFilePart(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getSummaryText(
  totals: NutritionTargets,
  targets: NutritionTargets
): string {
  const calorieDiff = round1(targets.calories - totals.calories);
  const proteinDiff = round1(targets.protein - totals.protein);
  return `${formatGoalStatus("热量", calorieDiff, "kcal")}，${formatGoalStatus(
    "蛋白质",
    proteinDiff,
    "g"
  )}`;
}

export function renderDailyMarkdown(record: DailyRecord): string {
  const lines: string[] = [
    `# ${formatDisplayDate(record.date)} 饮食记录`,
    "",
    `目标：热量 ${formatNumber(record.targets.calories)}kcal / 蛋白质 ${formatNumber(
      record.targets.protein
    )}g`,
    ""
  ];

  for (const meal of record.meals) {
    lines.push(`## ${meal.title}`, "");
    lines.push("| 名称 | 单位 | 热量 | 蛋白质 |");
    lines.push("| --- | --- | ---: | ---: |");
    for (const item of meal.items) {
      lines.push(
        `| ${item.name} | ${item.amount} | ${formatNumber(
          item.calories
        )}kcal | ${formatNumber(item.protein)}g |`
      );
    }
    lines.push("");
    lines.push(
      `本餐：热量 ${formatNumber(meal.totals.calories)}kcal / 蛋白质 ${formatNumber(
        meal.totals.protein
      )}g`
    );
    lines.push("");
  }

  lines.push("## 今日汇总", "");
  lines.push(
    `今日累计：热量 ${formatNumber(record.totals.calories)}kcal / 蛋白质 ${formatNumber(
      record.totals.protein
    )}g`
  );
  lines.push("");
  lines.push(`今日小结：${getSummaryText(record.totals, record.targets)}`);
  lines.push("");

  return lines.join("\n");
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(round1(value));
}

export function pngFileName(dateKey: string, mealTitle: string): string {
  return `${dateKey}_${safeFilePart(mealTitle)}_营养标注.png`;
}

export function markdownFileName(dateKey: string): string {
  return `${dateKey}.md`;
}

function sumItems(items: FoodItem[]): NutritionTargets {
  return {
    calories: round1(items.reduce((sum, item) => sum + item.calories, 0)),
    protein: round1(items.reduce((sum, item) => sum + item.protein, 0))
  };
}

function formatGoalStatus(label: string, remaining: number, unit: string): string {
  if (remaining > 0) {
    return `${label}还差 ${formatNumber(remaining)}${unit}`;
  }
  if (remaining < 0) {
    return `${label}已达标，超出 ${formatNumber(Math.abs(remaining))}${unit}`;
  }
  return `${label}刚好达标`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
