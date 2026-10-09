import { z } from 'zod';

const id = z.string().min(1);
const cm = z.number().int();
const positiveCm = z.number().int().positive();

export const Vec2Schema = z.object({ x: z.number().int(), y: z.number().int() });

export const WallSchema = z.object({
  id,
  a: Vec2Schema,
  b: Vec2Schema,
  thickness: positiveCm,
  height: positiveCm,
  verified: z.boolean().optional(),
});

export const OpeningSchema = z.object({
  id,
  wallId: id,
  kind: z.enum(['door', 'window', 'opening']),
  offset: cm.nonnegative(), // 벽 a점에서 개구부 시작까지
  width: positiveCm,
  height: positiveCm,
  sill: cm.nonnegative(),
  hinge: z.enum(['start', 'end']),
  swingIn: z.boolean(), // true: 벽 방향 u를 +90° 돌린 쪽(-uy, ux)으로 열림
  middle: z.boolean().optional(), // 현관 중문 (door만 의미)
  leaves: z.enum(['single', 'double', 'asym']).optional(), // 외여닫이 / 양여닫이 / 비대칭 양개, 없으면 single
  verified: z.boolean().optional(),
});

export const FloorMaterialSchema = z.enum(['wood', 'tile', 'plain']);
export const WallMaterialSchema = z.enum(['paint', 'wallpaper']);
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, '#rrggbb 형식이어야 합니다');
export const FloorFinishSchema = z.object({ material: FloorMaterialSchema, color: hexColor });
export const WallFinishSchema = z.object({ material: WallMaterialSchema, color: hexColor });
export const PlanFinishSchema = z.object({ floor: FloorFinishSchema, wall: WallFinishSchema });

export const RoomSchema = z.object({
  id,
  name: z.string(),
  label: Vec2Schema,
  polygon: z.array(Vec2Schema).min(3).optional(), // 바닥 영역(마감면 기준 꼭짓점, cm)
  floor: FloorFinishSchema.optional(),
  wall: WallFinishSchema.optional(),
});

export const ItemSchema = z.object({
  id,
  productId: id,
  variantId: id,
  x: cm,
  y: cm,
  rotation: z.number(),
  elevation: cm.nonnegative().optional(), // 바닥에서 밑면까지 설치 높이(cm). 없으면 제품 기본값(catalog/elevation.ts)
  label: z.string().optional(),
  locked: z.boolean().optional(),
  verified: z.boolean().optional(),
  note: z.string().optional(), // 아이템 메모(빈 문자열은 저장하지 않고 키를 지운다)
});

export const LayoutSchema = z.object({
  id,
  name: z.string().min(1),
  memo: z.string().optional(),
  items: z.array(ItemSchema),
});

export const FixtureSchema = z.object({
  id,
  kind: z.enum(['outlet', 'outlet-dedicated', 'outlet-waterproof', 'switch', 'light']),
  wallId: id.optional(),
  pos: Vec2Schema,
  height: cm.nonnegative(),
  memo: z.string().optional(),
});

export const ChecklistStateSchema = z.object({
  itemId: id,
  checked: z.boolean(),
  memo: z.string().optional(),
});

export const ClearanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('swing'), hinge: z.enum(['left', 'right']), radius: positiveCm }),
  z.object({ kind: z.literal('front'), depth: positiveCm }),
]);

export const BuilderIdSchema = z.enum([
  'box', 'fridge', 'front-loader', 'tv', 'sofa', 'bed', 'table',
  'stand-ac', 'built-in-appliance', 'cabinet-run', 'chair', 'wardrobe',
  'toilet', 'basin', 'shower', 'ceiling-ac',
]);

export const CategorySchema = z.enum(['kitchen', 'laundry', 'tv', 'climate', 'living', 'furniture', 'bath', 'custom']);

export const VariantSchema = z.object({
  id,
  label: z.string(),
  colors: z.record(z.string(), z.string()),
});

export const ProductSchema = z.object({
  id,
  brand: z.string(),
  model: z.string(),
  name: z.string(),
  category: CategorySchema,
  dims: z.object({ w: positiveCm, d: positiveCm, h: positiveCm }),
  variants: z.array(VariantSchema).min(1),
  builder: BuilderIdSchema,
  builderParams: z.record(z.string(), z.unknown()).optional(),
  clearances: z.array(ClearanceSchema),
  power: z.object({ watts: z.number().nonnegative(), dedicatedCircuit: z.boolean() }).optional(),
  builtIn: z.boolean(),
  mount: z.enum(['floor', 'wall', 'ceiling']),
  elevation: cm.nonnegative().optional(), // 제품 기본 설치 높이(cm). item.elevation → 이 값 → builderParams.mountHeight → mount 규칙
  sourceUrl: z.string().optional(),
});

export const PlanInfoSchema = z.object({
  title: z.string(),
  address: z.string().optional(),
  supplyArea: z.number().optional(),
  exclusiveArea: z.number().optional(),
  builtYear: z.number().int().optional(),
  moveInDate: z.string().optional(),
  scope: z.string().optional(),
  notes: z.string().optional(),
});

// 배경 이미지 안의 픽셀 좌표(실수)
const PxSchema = z.object({ x: z.number(), y: z.number() });

const CalibrationLineSchema = z.object({ a: PxSchema, b: PxSchema, lengthCm: positiveCm });

export const CalibrationSchema = CalibrationLineSchema.extend({ check: CalibrationLineSchema.optional() });

export const BackgroundSchema = z.object({
  imageRef: z.string(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  cmPerPx: z.number().positive(),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  calibration: CalibrationSchema.optional(),
});

export const PlanSchema = z
  .object({
    version: z.literal(6),
    info: PlanInfoSchema,
    background: BackgroundSchema.optional(),
    walls: z.array(WallSchema),
    openings: z.array(OpeningSchema),
    rooms: z.array(RoomSchema),
    finish: PlanFinishSchema.optional(),
    layouts: z.array(LayoutSchema).min(1),
    activeLayoutId: id,
    fixtures: z.array(FixtureSchema),
    checklist: z.array(ChecklistStateSchema),
    customProducts: z.array(ProductSchema),
  })
  .refine((p) => p.layouts.some((l) => l.id === p.activeLayoutId), {
    message: 'activeLayoutId가 layouts에 없습니다',
    path: ['activeLayoutId'],
  });

export type Vec2 = z.infer<typeof Vec2Schema>;
export type Wall = z.infer<typeof WallSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type DoorLeaves = NonNullable<Opening['leaves']>;
export type Room = z.infer<typeof RoomSchema>;
export type FloorMaterial = z.infer<typeof FloorMaterialSchema>;
export type WallMaterial = z.infer<typeof WallMaterialSchema>;
export type FloorFinish = z.infer<typeof FloorFinishSchema>;
export type WallFinish = z.infer<typeof WallFinishSchema>;
export type PlanFinish = z.infer<typeof PlanFinishSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type Fixture = z.infer<typeof FixtureSchema>;
export type Clearance = z.infer<typeof ClearanceSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type BuilderId = z.infer<typeof BuilderIdSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type Calibration = z.infer<typeof CalibrationSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type ChecklistState = z.infer<typeof ChecklistStateSchema>;
export type PlanInfo = z.infer<typeof PlanInfoSchema>;
