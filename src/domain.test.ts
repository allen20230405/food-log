import { describe, expect, test } from "vitest";
import {
  buildDailyRecord,
  createMeal,
  deleteMeal,
  formatDateKey,
  getSummaryText,
  parseMealInput,
  renderDailyMarkdown,
  safeFilePart
} from "./domain";

describe("parseMealInput", () => {
  test("parses the fixed meal format into title and food items", () => {
    const meal = parseMealInput(`
第一餐
酒酿 / 150g / 120 / 4
香蕉 / 1根 / 105 / 1
鸡蛋 / 2个 / 140 / 12
鱼肉 / 60g / 80 / 12
`);

    expect(meal).toEqual({
      title: "第一餐",
      items: [
        { name: "酒酿", amount: "150g", calories: 120, protein: 4 },
        { name: "香蕉", amount: "1根", calories: 105, protein: 1 },
        { name: "鸡蛋", amount: "2个", calories: 140, protein: 12 },
        { name: "鱼肉", amount: "60g", calories: 80, protein: 12 }
      ]
    });
  });

  test("reports the exact row when a food line misses fields", () => {
    expect(() => parseMealInput("第一餐\n香蕉 / 1根 / 105")).toThrow(
      "第 2 行需要 4 个字段"
    );
  });

  test("reports the exact row when nutrition values are not numbers", () => {
    expect(() => parseMealInput("第一餐\n香蕉 / 1根 / 一百 / 1")).toThrow(
      "第 2 行的热量必须是数字"
    );
    expect(() => parseMealInput("第一餐\n香蕉 / 1根 / 105 / 多")).toThrow(
      "第 2 行的蛋白质必须是数字"
    );
  });
});

describe("daily record", () => {
  test("adds meals and computes today's totals", () => {
    const first = createMeal(
      "m1",
      "第一餐",
      [
        { name: "酒酿", amount: "150g", calories: 120, protein: 4 },
        { name: "香蕉", amount: "1根", calories: 105, protein: 1 }
      ],
      "2026-07-01T08:00:00+08:00",
      "breakfast.jpg"
    );
    const second = createMeal(
      "m2",
      "第二餐",
      [{ name: "生米", amount: "240g", calories: 830, protein: 16.8 }],
      "2026-07-01T12:00:00+08:00",
      "lunch.jpg"
    );

    const record = buildDailyRecord("20260701", { calories: 2700, protein: 135 }, [
      first,
      second
    ]);

    expect(first.totals).toEqual({ calories: 225, protein: 5 });
    expect(record.totals).toEqual({ calories: 1055, protein: 21.8 });
  });

  test("deletes a meal and recomputes totals from remaining meals", () => {
    const first = createMeal("m1", "第一餐", [
      { name: "香蕉", amount: "1根", calories: 105, protein: 1 }
    ]);
    const second = createMeal("m2", "第二餐", [
      { name: "鸡蛋", amount: "2个", calories: 140, protein: 12 }
    ]);
    const record = buildDailyRecord("20260701", { calories: 2700, protein: 135 }, [
      first,
      second
    ]);

    const updated = deleteMeal(record, "m1");

    expect(updated.meals.map((meal) => meal.id)).toEqual(["m2"]);
    expect(updated.totals).toEqual({ calories: 140, protein: 12 });
  });
});

describe("output helpers", () => {
  test("formats local date keys and safe file parts", () => {
    expect(formatDateKey(new Date("2026-07-01T08:30:00+08:00"))).toBe("20260701");
    expect(safeFilePart("第一餐 / 早餐")).toBe("第一餐_早餐");
  });

  test("summarizes target gaps and overages", () => {
    expect(
      getSummaryText({ calories: 2510, protein: 163.2 }, { calories: 2700, protein: 135 })
    ).toBe("热量还差 190kcal，蛋白质已达标，超出 28.2g");
  });

  test("renders a complete markdown record sorted by saved time", () => {
    const late = createMeal(
      "m2",
      "第二餐",
      [{ name: "鸡蛋", amount: "2个", calories: 140, protein: 12 }],
      "2026-07-01T12:00:00+08:00"
    );
    const early = createMeal(
      "m1",
      "第一餐",
      [{ name: "香蕉", amount: "1根", calories: 105, protein: 1 }],
      "2026-07-01T08:00:00+08:00"
    );
    const record = buildDailyRecord("20260701", { calories: 2700, protein: 135 }, [
      late,
      early
    ]);

    expect(renderDailyMarkdown(record)).toContain("# 2026-07-01 饮食记录");
    expect(renderDailyMarkdown(record).indexOf("## 第一餐")).toBeLessThan(
      renderDailyMarkdown(record).indexOf("## 第二餐")
    );
    expect(renderDailyMarkdown(record)).toContain("| 名称 | 单位 | 热量 | 蛋白质 |");
    expect(renderDailyMarkdown(record)).toContain(
      "今日累计：热量 245kcal / 蛋白质 13g"
    );
  });
});
