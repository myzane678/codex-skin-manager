import Ajv from 'ajv';
import { Type, type Static } from '@sinclair/typebox';

const ThemeRuntimeStateSchema = Type.Union([
  Type.Literal('native'),
  Type.Literal('pending'),
  Type.Literal('applied'),
  Type.Literal('compatibility-degraded'),
  Type.Literal('recovering'),
]);

const CdpConnectionStateSchema = Type.Union([
  Type.Literal('disconnected'),
  Type.Literal('connecting'),
  Type.Literal('connected'),
  Type.Literal('failed'),
]);

const ProxyStateSchema = Type.Union([
  Type.Literal('disabled'),
  Type.Literal('watching'),
  Type.Literal('handling-candidate'),
  Type.Literal('failed'),
]);

const RecoveryStateSchema = Type.Union([
  Type.Literal('idle'),
  Type.Literal('running'),
  Type.Literal('restored'),
  Type.Literal('partial'),
  Type.Literal('manual-action'),
]);

export const AppSnapshotSchema = Type.Object(
  {
    theme: ThemeRuntimeStateSchema,
    cdp: CdpConnectionStateSchema,
    proxy: ProxyStateSchema,
    recovery: RecoveryStateSchema,
    runtimeRunId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    runtimeErrorCode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    runtimeAdapterId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { additionalProperties: false },
);

export type AppSnapshot = Static<typeof AppSnapshotSchema>;

const validate = new Ajv({ allErrors: true }).compile(AppSnapshotSchema);

export function validateAppSnapshot(value: unknown): value is AppSnapshot {
  return validate(value);
}
