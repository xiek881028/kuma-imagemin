# kuma-imagemin

[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

一个基于`mozjpeg`和`pngquant`压缩算法进行图片压缩的小工具。它通过将两个压缩算法的代码由`C`编译成`Javascript`，可以在`浏览器`与`Node`环境下运行，同时降低了依赖安装的难度。

> jpeg 压缩方法基于[mozjpeg-js](https://github.com/as-com/mozjpeg-js)
>
> png 压缩方法基于[pngquantjs](https://github.com/psych0der/pngquantjs)

## Install

```bash
npm install kuma-imagemin
```

## Usage

```javascript
const { minPng, minJpg } = require('kuma-imagemin');

// 压缩png
const pngRes = minPng('test.png', {
  quality: '60-80',
});
// 压缩后的png数据，格式为 Uint8Array
console.log(pngRes.data);
// 压缩率
console.log(pngRes.ratio);

// 压缩jpg
const jpgRes = minJpg('test.png', {
  quality: 0.6,
});
// 压缩后的jpg数据，格式为 Uint8Array
console.log(jpgRes.data);
// 压缩率
console.log(jpgRes.ratio);

// 压缩指定文件夹
minDir('img')
```

## License

由于`mozjpeg-js`使用`BSD 3`协议，`pngquantjs`使用`GPL v3`协议。故`kuma-imagemin`只能使用`GPL v3`协议。
