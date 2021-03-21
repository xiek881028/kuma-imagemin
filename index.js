/**
 * @file 图片压缩主文件
 * @author xiek881028(285985285@qq.com)
 */

const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');
const file = require('kuma-helpers/node/file');
const { encode: mozjpeg } = require('./lib/mozjpeg');
const pngquant = require('./lib/dist.min');

/**
 * png压缩方法
 *
 * @param {string} dir 需要压缩的图片地址
 * @return {Object} 返回一个包含压缩数据及压缩率的对象
 * @param {Uint8Array} data 压缩后的图片数据
 * @param {Number} ratio 压缩率
 */
exports.minPng = (dir, args = {}) => {
  const data = fs.readFileSync(dir);
  const res = pngquant(data, args, () => {}).data;
  return {
    data: res,
    ratio: res.length / data.length,
  };
};

/**
 * jpg压缩方法
 *
 * @param {string} dir 需要压缩的图片地址
 * @param {string} outPath 图片输出地址
 * @param {Object} option pngquant参数
 * @return {Object} 返回一个包含压缩数据及压缩率的对象
 * @param {Uint8Array} data 压缩后的图片数据
 * @param {Number} ratio 压缩率
 */
exports.minJpg = (dir, args = {}) => {
  const data = fs.readFileSync(dir);
  const res = mozjpeg(data, { quality: 100, ...args }).data;
  return {
    data: res,
    ratio: res.length / data.length,
  };
};

/**
 * 压缩指定文件夹
 *
 * @param {string} dir 需要压缩的文件夹路径
 */
exports.minDir = async dir => {
  const fileObj = file(dir, {
    loop: true,
  });
  const keys = Object.keys(fileObj);
  for (let i = 0; i < keys.length; i++) {
    // 替换所有 \ 保证兼容window路径
    const el = fileObj[keys[i]].replace(/\\/g, '\\\\');
    const { height, width, type } = await sizeOf(el);
    let fn;
    if (type === 'png') {
      fn = this.minPng;
    } else if (type === 'jpg') {
      fn = this.minJpg;
    }
    if (fn) {
      const { data, ratio } = fn(el);
      const imgPath = path.relative(path.join(__dirname, dir), el);
      const ext = path.extname(el);
      const newDir = path.dirname(el) + path.basename(el).replace(ext, `.origin${ext}`);
      console.log(`压缩${imgPath}...`);
      if (ratio < 1) {
        fs.copySync(el, newDir);
        fs.writeFileSync(el, data);
        console.log(`压缩率${(100 - ratio * 100).toFixed(2)}%`);
      } else {
        console.log(`压缩率小于0，放弃压缩`);
      }
    }
  }
};
