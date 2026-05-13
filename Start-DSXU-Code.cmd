@echo off
setlocal
title DSXU Code
cd /d D:\DSXU-code
set DSXU_CODE_MODE=1
set DSXU_PRODUCT_NAME=DSXU Code
set DSXU_CODE_SIMPLE=
bun src/entrypoints/dsxu-code.tsx
pause
