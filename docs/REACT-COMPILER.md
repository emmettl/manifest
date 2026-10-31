# Native React Compiler

The Vite React plugin compiles application React code using
`react({ compiler: true })` and exact `oxc-transform-react@0.152.0`, matching
`@vitejs/plugin-react@6.1.2`. Installed shared packages keep their existing build.
Existing manual memoization and compiler bailouts are retained.

Two independent paired production rounds found lower seek CPU in every compiler
sample. In the confirmation round, median JavaScript CPU for 120 consecutive
timeline steps was **2423.96 → 2161.64 ms
(-10.8%)**. Total emitted JavaScript grows by **7,765 gzipped bytes**.
Measurements used three alternating baseline/compiler samples, Chromium/ANGLE
Metal on an Apple M4 Max and 4× CPU throttling. These are interaction CPU results,
not physical-phone or FPS claims.

The native integration is experimental. No hook-rule checks or suppressions were
removed to increase compilation coverage. Other Motion Studies adopt different
scopes according to their measurements; shared npm packages remain unchanged.

[Cross-study report, method and raw evidence](https://github.com/emmettl/motionstudies/blob/main/docs/REACT-COMPILER.md).
