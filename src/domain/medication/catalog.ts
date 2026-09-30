/**
 * 혈압·혈당·콜레스테롤 관리 약 성분·함량 카탈로그 (생체나이 보정용)
 *
 * - 제품(상품)명 대신 **성분명 + 1정당 함량**으로 정의한다. 사용자는 약 이름을 자유롭게 적고,
 *   성분·함량을 목록에서 고른다. 복합제는 단일 성분으로 나눠 하루 용량을 계산한다.
 * - 주사제(인슐린·GLP-1 등)와 목록에 없는 약은 보정하지 않는다 (복용 사실만 반영).
 * - 이 카탈로그는 약을 평가·권유하기 위한 것이 아니라, "약을 먹지 않았다면 수치가 어느 정도였을지"
 *   추정하기 위한 참고 자료다. 값을 바꾸면 BIO_AGE_VERSION을 올린다.
 */

/** 복용 목적 = 생체나이 보정 대상 (analysis/types의 ManagedCondition과 같은 값) */
export type Therapy = "BLOOD_PRESSURE" | "GLUCOSE" | "LIPID";

export const THERAPY_LABELS: Record<Therapy, string> = {
  BLOOD_PRESSURE: "혈압약",
  GLUCOSE: "당뇨약",
  LIPID: "고지혈증약",
};

/** 목적 입력이 비어 있을 때 채워 넣는 문구 (snapshot.inferManagedConditions 키워드와 맞춤) */
export const THERAPY_PURPOSES: Record<Therapy, string> = {
  BLOOD_PRESSURE: "혈압",
  GLUCOSE: "혈당(당뇨)",
  LIPID: "콜레스테롤",
};

export type DrugClass =
  // 혈압
  | "CCB"
  | "ARB"
  | "ACEI"
  | "THIAZIDE"
  | "BETA_BLOCKER"
  // 혈당
  | "METFORMIN"
  | "SULFONYLUREA"
  | "DPP4"
  | "SGLT2"
  | "TZD"
  // 지질
  | "STATIN"
  | "EZETIMIBE"
  | "FIBRATE"
  | "OMEGA3";

export const DRUG_CLASS_THERAPY: Record<DrugClass, Therapy> = {
  CCB: "BLOOD_PRESSURE",
  ARB: "BLOOD_PRESSURE",
  ACEI: "BLOOD_PRESSURE",
  THIAZIDE: "BLOOD_PRESSURE",
  BETA_BLOCKER: "BLOOD_PRESSURE",
  METFORMIN: "GLUCOSE",
  SULFONYLUREA: "GLUCOSE",
  DPP4: "GLUCOSE",
  SGLT2: "GLUCOSE",
  TZD: "GLUCOSE",
  STATIN: "LIPID",
  EZETIMIBE: "LIPID",
  FIBRATE: "LIPID",
  OMEGA3: "LIPID",
};

export const DRUG_CLASS_LABELS: Record<DrugClass, string> = {
  CCB: "칼슘통로차단제",
  ARB: "안지오텐신수용체차단제",
  ACEI: "안지오텐신전환효소억제제",
  THIAZIDE: "이뇨제(티아지드계)",
  BETA_BLOCKER: "베타차단제",
  METFORMIN: "메트포르민",
  SULFONYLUREA: "설포닐우레아",
  DPP4: "DPP-4 억제제",
  SGLT2: "SGLT-2 억제제",
  TZD: "티아졸리딘디온",
  STATIN: "스타틴",
  EZETIMIBE: "에제티미브",
  FIBRATE: "피브레이트",
  OMEGA3: "오메가-3 지방산(처방용)",
};

export type Ingredient = {
  code: string;
  name: string;
  drugClass: DrugClass;
  /** 표준 하루 용량(mg) — 효과 크기의 기준점 (rules/medication-effects.ts) */
  standardDailyMg: number;
};

const ingredientList: Ingredient[] = [
  // 혈압 — 표준 용량은 Law et al. BMJ 2003/2009 메타분석의 "standard dose"와 국내 흔한 용량 기준
  {
    code: "AMLODIPINE",
    name: "암로디핀",
    drugClass: "CCB",
    standardDailyMg: 5,
  },
  {
    code: "NIFEDIPINE",
    name: "니페디핀(서방)",
    drugClass: "CCB",
    standardDailyMg: 30,
  },
  { code: "LOSARTAN", name: "로사르탄", drugClass: "ARB", standardDailyMg: 50 },
  {
    code: "VALSARTAN",
    name: "발사르탄",
    drugClass: "ARB",
    standardDailyMg: 80,
  },
  {
    code: "TELMISARTAN",
    name: "텔미사르탄",
    drugClass: "ARB",
    standardDailyMg: 40,
  },
  {
    code: "OLMESARTAN",
    name: "올메사르탄",
    drugClass: "ARB",
    standardDailyMg: 20,
  },
  {
    code: "CANDESARTAN",
    name: "칸데사르탄",
    drugClass: "ARB",
    standardDailyMg: 8,
  },
  {
    code: "IRBESARTAN",
    name: "이르베사르탄",
    drugClass: "ARB",
    standardDailyMg: 150,
  },
  {
    code: "FIMASARTAN",
    name: "피마사르탄",
    drugClass: "ARB",
    standardDailyMg: 60,
  },
  { code: "RAMIPRIL", name: "라미프릴", drugClass: "ACEI", standardDailyMg: 5 },
  {
    code: "PERINDOPRIL",
    name: "페린도프릴",
    drugClass: "ACEI",
    standardDailyMg: 4,
  },
  {
    code: "HCTZ",
    name: "히드로클로로티아지드",
    drugClass: "THIAZIDE",
    standardDailyMg: 25,
  },
  {
    code: "CHLORTHALIDONE",
    name: "클로르탈리돈",
    drugClass: "THIAZIDE",
    standardDailyMg: 25,
  },
  {
    code: "INDAPAMIDE",
    name: "인다파미드(서방)",
    drugClass: "THIAZIDE",
    standardDailyMg: 1.5,
  },
  {
    code: "BISOPROLOL",
    name: "비소프롤롤",
    drugClass: "BETA_BLOCKER",
    standardDailyMg: 5,
  },
  {
    code: "NEBIVOLOL",
    name: "네비볼롤",
    drugClass: "BETA_BLOCKER",
    standardDailyMg: 5,
  },
  {
    code: "CARVEDILOL",
    name: "카르베딜롤",
    drugClass: "BETA_BLOCKER",
    standardDailyMg: 25,
  },
  {
    code: "ATENOLOL",
    name: "아테놀롤",
    drugClass: "BETA_BLOCKER",
    standardDailyMg: 50,
  },
  // 혈당
  {
    code: "METFORMIN",
    name: "메트포르민",
    drugClass: "METFORMIN",
    standardDailyMg: 1500,
  },
  {
    code: "GLIMEPIRIDE",
    name: "글리메피리드",
    drugClass: "SULFONYLUREA",
    standardDailyMg: 2,
  },
  {
    code: "GLICLAZIDE",
    name: "글리클라지드(서방)",
    drugClass: "SULFONYLUREA",
    standardDailyMg: 60,
  },
  {
    code: "SITAGLIPTIN",
    name: "시타글립틴",
    drugClass: "DPP4",
    standardDailyMg: 100,
  },
  {
    code: "LINAGLIPTIN",
    name: "리나글립틴",
    drugClass: "DPP4",
    standardDailyMg: 5,
  },
  {
    code: "GEMIGLIPTIN",
    name: "제미글립틴",
    drugClass: "DPP4",
    standardDailyMg: 50,
  },
  {
    code: "EVOGLIPTIN",
    name: "에보글립틴",
    drugClass: "DPP4",
    standardDailyMg: 5,
  },
  {
    code: "TENELIGLIPTIN",
    name: "테네리글립틴",
    drugClass: "DPP4",
    standardDailyMg: 20,
  },
  {
    code: "VILDAGLIPTIN",
    name: "빌다글립틴",
    drugClass: "DPP4",
    standardDailyMg: 100,
  },
  {
    code: "DAPAGLIFLOZIN",
    name: "다파글리플로진",
    drugClass: "SGLT2",
    standardDailyMg: 10,
  },
  {
    code: "EMPAGLIFLOZIN",
    name: "엠파글리플로진",
    drugClass: "SGLT2",
    standardDailyMg: 10,
  },
  {
    code: "ENAVOGLIFLOZIN",
    name: "엔블로글리플로진",
    drugClass: "SGLT2",
    standardDailyMg: 0.3,
  },
  {
    code: "PIOGLITAZONE",
    name: "피오글리타존",
    drugClass: "TZD",
    standardDailyMg: 30,
  },
  {
    code: "LOBEGLITAZONE",
    name: "로베글리타존",
    drugClass: "TZD",
    standardDailyMg: 0.5,
  },
  // 지질
  {
    code: "ATORVASTATIN",
    name: "아토르바스타틴",
    drugClass: "STATIN",
    standardDailyMg: 10,
  },
  {
    code: "ROSUVASTATIN",
    name: "로수바스타틴",
    drugClass: "STATIN",
    standardDailyMg: 10,
  },
  {
    code: "SIMVASTATIN",
    name: "심바스타틴",
    drugClass: "STATIN",
    standardDailyMg: 20,
  },
  {
    code: "PRAVASTATIN",
    name: "프라바스타틴",
    drugClass: "STATIN",
    standardDailyMg: 40,
  },
  {
    code: "PITAVASTATIN",
    name: "피타바스타틴",
    drugClass: "STATIN",
    standardDailyMg: 2,
  },
  {
    code: "EZETIMIBE",
    name: "에제티미브",
    drugClass: "EZETIMIBE",
    standardDailyMg: 10,
  },
  {
    code: "FENOFIBRATE",
    name: "페노피브레이트",
    drugClass: "FIBRATE",
    standardDailyMg: 160,
  },
  {
    code: "OMEGA3_EE",
    name: "오메가-3-산 에틸에스테르",
    drugClass: "OMEGA3",
    standardDailyMg: 4000,
  },
];

export const INGREDIENTS: Record<string, Ingredient> = Object.fromEntries(
  ingredientList.map((i) => [i.code, i]),
);

export type ProductComponent = { ingredient: string; mg: number };

export type DrugProduct = {
  code: string;
  /** 화면 표시용 — 성분명과 1정당 함량 */
  label: string;
  components: ProductComponent[];
};

/** 단일제: 성분 × 흔한 함량 */
const SINGLE_STRENGTHS: Record<string, number[]> = {
  AMLODIPINE: [2.5, 5, 10],
  NIFEDIPINE: [30, 60],
  LOSARTAN: [25, 50, 100],
  VALSARTAN: [40, 80, 160, 320],
  TELMISARTAN: [40, 80],
  OLMESARTAN: [10, 20, 40],
  CANDESARTAN: [8, 16, 32],
  IRBESARTAN: [150, 300],
  FIMASARTAN: [30, 60, 120],
  RAMIPRIL: [2.5, 5, 10],
  PERINDOPRIL: [4, 8],
  HCTZ: [12.5, 25],
  CHLORTHALIDONE: [12.5, 25],
  INDAPAMIDE: [1.5],
  BISOPROLOL: [2.5, 5, 10],
  NEBIVOLOL: [5],
  CARVEDILOL: [6.25, 12.5, 25],
  ATENOLOL: [25, 50, 100],
  METFORMIN: [250, 500, 850, 1000],
  GLIMEPIRIDE: [1, 2, 4],
  GLICLAZIDE: [30, 60],
  SITAGLIPTIN: [50, 100],
  LINAGLIPTIN: [5],
  GEMIGLIPTIN: [50],
  EVOGLIPTIN: [5],
  TENELIGLIPTIN: [20],
  VILDAGLIPTIN: [50],
  DAPAGLIFLOZIN: [5, 10],
  EMPAGLIFLOZIN: [10, 25],
  ENAVOGLIFLOZIN: [0.3],
  PIOGLITAZONE: [15, 30],
  LOBEGLITAZONE: [0.5],
  ATORVASTATIN: [10, 20, 40, 80],
  ROSUVASTATIN: [5, 10, 20],
  SIMVASTATIN: [10, 20, 40],
  PRAVASTATIN: [10, 20, 40],
  PITAVASTATIN: [1, 2, 4],
  EZETIMIBE: [10],
  FENOFIBRATE: [145, 160, 200],
  OMEGA3_EE: [1000],
};

/** 복합제: [성분 코드들, 함량 조합들] — 흔히 쓰이는 2·3제 복합제 */
const COMBINATIONS: [string[], number[][]][] = [
  // 혈압 복합제
  [
    ["AMLODIPINE", "VALSARTAN"],
    [
      [5, 80],
      [5, 160],
      [10, 160],
    ],
  ],
  [
    ["AMLODIPINE", "LOSARTAN"],
    [
      [5, 50],
      [5, 100],
    ],
  ],
  [
    ["AMLODIPINE", "TELMISARTAN"],
    [
      [5, 40],
      [5, 80],
      [10, 80],
    ],
  ],
  [
    ["AMLODIPINE", "OLMESARTAN"],
    [
      [5, 20],
      [5, 40],
      [10, 40],
    ],
  ],
  [
    ["AMLODIPINE", "FIMASARTAN"],
    [
      [5, 60],
      [10, 60],
    ],
  ],
  [
    ["VALSARTAN", "HCTZ"],
    [
      [80, 12.5],
      [160, 12.5],
      [160, 25],
    ],
  ],
  [
    ["LOSARTAN", "HCTZ"],
    [
      [50, 12.5],
      [100, 12.5],
      [100, 25],
    ],
  ],
  [
    ["TELMISARTAN", "HCTZ"],
    [
      [40, 12.5],
      [80, 12.5],
      [80, 25],
    ],
  ],
  [
    ["OLMESARTAN", "HCTZ"],
    [
      [20, 12.5],
      [40, 12.5],
    ],
  ],
  [
    ["AMLODIPINE", "VALSARTAN", "HCTZ"],
    [
      [5, 160, 12.5],
      [10, 160, 12.5],
    ],
  ],
  [
    ["AMLODIPINE", "OLMESARTAN", "HCTZ"],
    [
      [5, 20, 12.5],
      [5, 40, 12.5],
    ],
  ],
  // 혈당 복합제
  [
    ["SITAGLIPTIN", "METFORMIN"],
    [
      [50, 500],
      [50, 850],
      [50, 1000],
    ],
  ],
  [
    ["LINAGLIPTIN", "METFORMIN"],
    [
      [2.5, 500],
      [2.5, 850],
      [2.5, 1000],
    ],
  ],
  [
    ["GEMIGLIPTIN", "METFORMIN"],
    [
      [50, 500],
      [50, 1000],
    ],
  ],
  [
    ["EVOGLIPTIN", "METFORMIN"],
    [
      [5, 500],
      [5, 1000],
    ],
  ],
  [
    ["VILDAGLIPTIN", "METFORMIN"],
    [
      [50, 500],
      [50, 850],
      [50, 1000],
    ],
  ],
  [
    ["DAPAGLIFLOZIN", "METFORMIN"],
    [
      [5, 1000],
      [10, 500],
      [10, 1000],
    ],
  ],
  [
    ["EMPAGLIFLOZIN", "METFORMIN"],
    [
      [5, 500],
      [12.5, 500],
      [12.5, 1000],
    ],
  ],
  [
    ["GLIMEPIRIDE", "METFORMIN"],
    [
      [1, 500],
      [2, 500],
      [2, 1000],
    ],
  ],
  [
    ["EMPAGLIFLOZIN", "LINAGLIPTIN"],
    [
      [10, 5],
      [25, 5],
    ],
  ],
  [["DAPAGLIFLOZIN", "SITAGLIPTIN"], [[10, 100]]],
  [["PIOGLITAZONE", "METFORMIN"], [[15, 850]]],
  // 지질 복합제
  [
    ["ROSUVASTATIN", "EZETIMIBE"],
    [
      [5, 10],
      [10, 10],
      [20, 10],
    ],
  ],
  [
    ["ATORVASTATIN", "EZETIMIBE"],
    [
      [10, 10],
      [20, 10],
      [40, 10],
    ],
  ],
  [
    ["SIMVASTATIN", "EZETIMIBE"],
    [
      [20, 10],
      [40, 10],
    ],
  ],
  [
    ["PITAVASTATIN", "EZETIMIBE"],
    [
      [2, 10],
      [4, 10],
    ],
  ],
  // 혈압+지질 복합제
  [
    ["AMLODIPINE", "ATORVASTATIN"],
    [
      [5, 10],
      [5, 20],
      [10, 10],
    ],
  ],
  [
    ["AMLODIPINE", "ROSUVASTATIN"],
    [
      [5, 10],
      [5, 20],
    ],
  ],
  [
    ["TELMISARTAN", "ROSUVASTATIN"],
    [
      [40, 10],
      [80, 10],
      [80, 20],
    ],
  ],
  [
    ["OLMESARTAN", "ROSUVASTATIN"],
    [
      [20, 5],
      [40, 10],
    ],
  ],
  [
    ["VALSARTAN", "ROSUVASTATIN"],
    [
      [80, 10],
      [160, 20],
    ],
  ],
];

const fmt = (mg: number) =>
  mg >= 1000 && mg % 1000 === 0 ? `${mg / 1000}g` : `${mg}mg`;

function productCode(components: ProductComponent[]): string {
  return components.map((c) => `${c.ingredient}_${c.mg}`).join("+");
}

function productLabel(components: ProductComponent[]): string {
  const names = components.map((c) => INGREDIENTS[c.ingredient].name).join("+");
  if (components.length === 1) return `${names} ${fmt(components[0].mg)}`;
  const doses = components.map((c) => c.mg).join("/");
  return `${names} ${doses}mg (복합제)`;
}

function buildProducts(): DrugProduct[] {
  const products: DrugProduct[] = [];
  for (const [ingredient, strengths] of Object.entries(SINGLE_STRENGTHS)) {
    for (const mg of strengths) {
      const components = [{ ingredient, mg }];
      products.push({
        code: productCode(components),
        label: productLabel(components),
        components,
      });
    }
  }
  for (const [ingredients, doseSets] of COMBINATIONS) {
    for (const doses of doseSets) {
      const components = ingredients.map((ingredient, i) => ({
        ingredient,
        mg: doses[i],
      }));
      products.push({
        code: productCode(components),
        label: productLabel(components),
        components,
      });
    }
  }
  return products;
}

export const DRUG_PRODUCTS: DrugProduct[] = buildProducts();

const productByCode = new Map(DRUG_PRODUCTS.map((p) => [p.code, p]));

export function findProduct(code: string | null | undefined) {
  return code ? productByCode.get(code) : undefined;
}

/** 제품에 포함된 성분의 복용 목적 (복합제는 여러 개) */
export function productTherapies(product: DrugProduct): Therapy[] {
  const set = new Set(
    product.components.map(
      (c) => DRUG_CLASS_THERAPY[INGREDIENTS[c.ingredient].drugClass],
    ),
  );
  return (["BLOOD_PRESSURE", "GLUCOSE", "LIPID"] as const).filter((t) =>
    set.has(t),
  );
}

/** 화면의 선택 목록: 복용 목적별로 묶는다 (복합제는 첫 번째 목적에 한 번만) */
export function productOptionGroups(): {
  therapy: Therapy;
  label: string;
  products: DrugProduct[];
}[] {
  return (["BLOOD_PRESSURE", "GLUCOSE", "LIPID"] as const).map((therapy) => ({
    therapy,
    label: THERAPY_LABELS[therapy],
    products: DRUG_PRODUCTS.filter(
      (p) => productTherapies(p)[0] === therapy,
    ).sort((a, b) =>
      a.components.length !== b.components.length
        ? a.components.length - b.components.length
        : a.label.localeCompare(b.label, "ko"),
    ),
  }));
}

/** 하루 복용 알 수 허용 범위 */
export const DAILY_TABLETS_RANGE = { min: 0.25, max: 8 } as const;

export type IngredientDose = {
  ingredient: string;
  /** 하루 총 용량 mg (함량 × 하루 알 수) */
  dailyMg: number;
};

/**
 * 복용약 목록 → 성분별 하루 용량 (같은 성분이 여러 약에 있으면 합친다)
 * 성분·함량을 고르지 않은 약은 제외한다.
 */
export function splitIntoIngredients(
  meds: { drugCode?: string | null; dailyTablets?: number | null }[],
): IngredientDose[] {
  const total = new Map<string, number>();
  for (const m of meds) {
    const product = findProduct(m.drugCode);
    if (!product) continue;
    const tablets = m.dailyTablets && m.dailyTablets > 0 ? m.dailyTablets : 1;
    for (const c of product.components) {
      total.set(c.ingredient, (total.get(c.ingredient) ?? 0) + c.mg * tablets);
    }
  }
  return [...total.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ingredient, dailyMg]) => ({
      ingredient,
      dailyMg: Math.round(dailyMg * 100) / 100,
    }));
}
