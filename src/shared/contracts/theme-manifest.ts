import Ajv from 'ajv';
import { Type, type Static } from '@sinclair/typebox';

const AssetSchema = Type.Object(
  {
    path: Type.String({ minLength: 1, maxLength: 240 }),
    mime: Type.Union([
      Type.Literal('image/png'),
      Type.Literal('image/jpeg'),
      Type.Literal('image/gif'),
      Type.Literal('image/webp'),
      Type.Literal('image/svg+xml'),
    ]),
    sha256: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  },
  { additionalProperties: false },
);

export const ThemeManifestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    id: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 64 }),
    name: Type.String({ minLength: 1, maxLength: 80 }),
    version: Type.String({ pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?$' }),
    author: Type.String({ minLength: 1, maxLength: 80 }),
    description: Type.String({ minLength: 1, maxLength: 240 }),
    codexCompatibility: Type.String({ minLength: 1, maxLength: 64 }),
    license: Type.String({ minLength: 1, maxLength: 64 }),
    source: Type.Literal('unknown'),
    appearance: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('light'), Type.Literal('dark')])),
    variables: Type.Object(
      { accent: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }) },
      { additionalProperties: false },
    ),
    slots: Type.Object(
      { header: Type.Union([Type.Literal('compact'), Type.Literal('standard')]) },
      { additionalProperties: false },
    ),
    motion: Type.Object(
      { enabled: Type.Boolean() },
      { additionalProperties: false },
    ),
    shell: Type.Optional(Type.Object(
      {
        surfaceOpacity: Type.Integer({ minimum: 35, maximum: 96 }),
        sidebarOpacity: Type.Integer({ minimum: 35, maximum: 96 }),
        blurPx: Type.Integer({ minimum: 0, maximum: 32 }),
        borderColor: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
        textColor: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
        mutedTextColor: Type.String({ pattern: '^#[0-9a-fA-F]{6}$' }),
      },
      { additionalProperties: false },
    )),
    background: Type.Optional(Type.Object(
      {
        assetPath: Type.String({ minLength: 1, maxLength: 240 }),
        placement: Type.Union([Type.Literal('cover'), Type.Literal('ambient')]),
        focusX: Type.Integer({ minimum: 0, maximum: 100 }),
        focusY: Type.Integer({ minimum: 0, maximum: 100 }),
        readability: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
        imageLayout: Type.Optional(Type.Union([Type.Literal('wide'), Type.Literal('standard')])),
        safeArea: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('left'), Type.Literal('center'), Type.Literal('right')])),
        taskMode: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('ambient'), Type.Literal('banner'), Type.Literal('off')])),
      },
      { additionalProperties: false },
    )),
    copy: Type.Object(
      { greeting: Type.String({ minLength: 1, maxLength: 80 }) },
      { additionalProperties: false },
    ),
    preview: AssetSchema,
    assets: Type.Array(AssetSchema, { maxItems: 126 }),
  },
  { additionalProperties: false },
);

export type ThemeManifest = Static<typeof ThemeManifestSchema>;

const validate = new Ajv({ allErrors: true }).compile(ThemeManifestSchema);

export function parseThemeManifest(value: unknown): ThemeManifest {
  if (!validate(value)) {
    throw new ThemePackageError('THEME_MANIFEST_INVALID', '主题清单不符合受控 schema');
  }
  return value;
}

export class ThemePackageError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ThemePackageError';
  }
}
