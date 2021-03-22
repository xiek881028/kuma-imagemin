/**
 * @file 图片压缩主文件
 * @author xiek881028(285985285@qq.com)
 */

const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');
const md5 = require('md5');
const file = require('kuma-helpers/node/file');
const { encode: mozjpeg } = require('./lib/mozjpeg');
const pngquant = require('./lib/pngquant');

/**
 * png压缩方法
 *
 * @param {string} data 需要压缩的图片
 * @return {Object} 返回一个包含压缩数据及压缩率的对象
 * @param {Uint8Array} data 压缩后的图片数据
 * @param {Number} ratio 压缩率
 */
exports.minPng = (data, args = {}) => {
  const res = pngquant(data, args, () => {}).data;
  return {
    data: res,
    ratio: res.length / data.length,
  };
};

/**
 * jpg压缩方法
 *
 * @param {string} data 需要压缩的图片
 * @param {string} outPath 图片输出地址
 * @param {Object} option pngquant参数
 * @return {Object} 返回一个包含压缩数据及压缩率的对象
 * @param {Uint8Array} data 压缩后的图片数据
 * @param {Number} ratio 压缩率
 */
exports.minJpg = (data, args = {}) => {
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
 * @param {Object} option pngquant参数
 * @param {Boolean} backup 是否生成备份文件
 * @param {Boolean} force 是否强制压缩文件
 */
exports.minDir = async (dir, ops = {}) => {
  const { backup, force } = {
    // 默认生成origin文件，保留源文件
    backup: true,
    // 记录文件缓存，有缓存则不压缩
    force: false,
    ...ops,
  };
  const fileObj = file(dir, {
    loop: true,
  });
  const keys = Object.keys(fileObj);
  for (let i = 0; i < keys.length; i++) {
    // 替换所有 \ 保证兼容window路径
    const el = fileObj[keys[i]].replace(/\\/g, '\\\\');
    // 如果文件是备份文件则跳过
    if (/(kuma_origin)$/.test(path.parse(el).name)) {
      continue;
    }
    const { height, width, type } = await sizeOf(el);
    let fn;
    if (type === 'png') {
      fn = this.minPng;
    } else if (type === 'jpg') {
      fn = this.minJpg;
    }
    if (fn) {
      const logPath = path.join(__dirname, '_log.json');
      if (!fs.existsSync(logPath)) {
        fs.writeJsonSync(
          logPath,
          {},
          {
            spaces: 2,
          }
        );
      }
      const log = fs.readJsonSync(logPath);
      const buffer = fs.readFileSync(el);
      // 对比md5，判断图片是否已经被压缩，如果开启force，则一定压缩
      if (force || log[el] !== md5(buffer)) {
        const { data, ratio } = fn(buffer);
        const imgPath = path.relative(path.join(dir), el);
        const ext = path.extname(el);
        const newDir = path.dirname(el) + path.basename(el).replace(ext, `.kuma_origin${ext}`);
        console.log(`压缩${imgPath}...`);
        if (ratio < 1) {
          // 如果有原始文件，则删除
          fs.removeSync(newDir);
          // 如果需要备份，生成新的原始文件
          backup && fs.copySync(el, newDir);
          fs.writeFileSync(el, data);
          console.log(`压缩率${(100 - ratio * 100).toFixed(2)}%`);
          log[el] = md5(data);
        } else {
          console.log(`压缩率小于0，放弃压缩`);
          log[el] = md5(buffer);
        }
        fs.writeJsonSync(logPath, log, {
          spaces: 2,
        });
      }
    }
  }
};

exports.clearOrigin = async dir => {
  const fileObj = file(dir, {
    loop: true,
  });
  const keys = Object.keys(fileObj);
  for (let i = 0; i < keys.length; i++) {
    // 替换所有 \ 保证兼容window路径
    const el = fileObj[keys[i]].replace(/\\/g, '\\\\');
    /(kuma_origin)$/.test(path.parse(el).name) && fs.removeSync(el);
  }
};

exports.clearLog = async () => {
  fs.removeSync(path.join(__dirname, '_log.json'));
};
