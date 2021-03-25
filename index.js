/**
 * @file 图片压缩主文件
 * @author xiek881028(285985285@qq.com)
 */

const fs = require('fs-extra');
const path = require('path');
const sizeOf = require('image-size');
const md5 = require('md5');
const pkgDir = require('pkg-dir');
const file = require('kuma-helpers/node/file');
const envPaths = require('env-paths');
const pkg = require('./package.json');
const { encode: mozjpeg } = require('./lib/mozjpeg');
const pngquant = require('./lib/pngquant');
// 以shell运行路径向上寻找最近的package.json作为工作根路径。否则使用系统env地址作为数据存储地
const workDir = pkgDir.sync(process.cwd()) || envPaths('kuma-imagemin', { suffix: '' }).data;
const updateNotifier = require('update-notifier');

updateNotifier({ pkg }).notify();

/**
 * 读取日志
 *
 * @return {JSON} 返回一个包含md5列表和统计的对象
 */
exports.readLog = () => {
  const logPath = path.join(workDir, 'kuma-imagemin.log');
  if (!fs.existsSync(logPath)) {
    fs.ensureDirSync(workDir);
    fs.writeJsonSync(
      logPath,
      {
        data: {},
        count: {
          max: 0,
          min: 0,
          total: 0,
          preLen: 0,
          nextLen: 0,
          best: 0,
          quit: 0,
          error: 0,
        },
      },
      {
        spaces: 2,
      }
    );
  }
  return fs.readJsonSync(logPath);
};

/**
 * png压缩方法（纯粹的压缩方法，需要自己写入日志，添加统计信息）
 *
 * @param {String} data 需要压缩的图片
 * @param {JSON=} args 配置项
 * @return {JSON} 返回一个包含压缩数据及压缩率的对象
 * @param {Uint8Array} data 压缩后的图片数据
 * @param {Number} ratio 压缩率
 */
exports.minPng = (data, args = {}) => {
  const { quality, ...other } = args;
  // 抹平不同压缩算法处理quality的差异，因为png有损，会压缩失败，间隔调整为10减少失败概率
  let _quality;
  if (quality - 1 <= 0) {
    _quality = `0-10`;
  } else if (quality >= 100) {
    _quality = undefined;
  } else {
    _quality = `${quality - 10}-${quality}`;
  }
  const res = pngquant(data, { quality: _quality, ...other }, () => {}).data;
  return {
    data: res,
    flag: res !== undefined,
    ratio: (res?.length ?? 0) / data.length,
  };
};

/**
 * jpg压缩方法（纯粹的压缩方法，需要自己写入日志，添加统计信息）
 *
 * @param {String} data 需要压缩的图
 * @param {JSON=} args pngquant参数
 * @returns {JSON} 返回一个包含压缩数据及压缩率的对象
 * @param {Uint8Array} data 压缩后的图片数据
 * @param {Number} ratio 压缩率
 */
exports.minJpg = (data, args = {}) => {
  const res = mozjpeg(data, { quality: 100, ...args }).data;
  return {
    data: res,
    // jpg压缩失败也会返回data，所以一定成功
    flag: true,
    ratio: res.length / data.length,
  };
};

/**
 * 添加压缩日志
 *
 * @param {JSON} data 记录的日志对象
 * @param {JSON} count 统计信息
 */
exports.log = (data = {}, count) => {
  const { data: list } = this.readLog();
  const logPath = path.join(workDir, 'kuma-imagemin.log');
  fs.writeJsonSync(
    logPath,
    {
      data: { ...list, ...data },
      count,
    },
    {
      spaces: 2,
    }
  );
};

/**
 * 判断一个文件是否已经被压缩（依赖日志记录）
 *
 * @param {String} dir 需要检查的文件路径
 * @return {Boolean} 文件是否被压缩
 */
exports.isMin = dir => {
  const { data } = this.readLog();
  const buffer = fs.readFileSync(dir);
  return data[dir] === md5(buffer);
};

/**
 * 压缩指定文件夹
 *
 * @param {String} dir 需要压缩的文件夹路径
 * @param {JSON} option pngquant参数
 * @param {Boolean} backup 是否生成备份文件
 * @param {Boolean} force 是否强制压缩文件
 */
exports.minDir = async (dir, ops = {}) => {
  const { backup, force, quality } = {
    // 默认生成origin文件，保留源文件
    backup: true,
    // 记录文件缓存，有缓存则不压缩
    force: false,
    // 压缩质量，默认最高
    quality: 100,
    ...ops,
  };
  const fileObj = file(dir, {
    loop: true,
  });
  const keys = Object.keys(fileObj);
  for (let i = 0; i < keys.length; i++) {
    // 替换所有 \ 保证兼容
    const el = fileObj[keys[i]].replace(/\\/g, '/');
    // 如果文件是备份文件则跳过
    if (/(kuma_origin)$/.test(path.parse(el).name)) {
      continue;
    }
    let info = {};
    try {
      info = await sizeOf(el);
    } catch (error) {
      // 不能识别的类型，跳过
      continue;
    }
    const { height, width, type } = info;
    let fn;
    if (type === 'png') {
      fn = this.minPng;
    } else if (type === 'jpg') {
      fn = this.minJpg;
    }
    if (fn) {
      const { data: list, count } = this.readLog();
      const buffer = fs.readFileSync(el);
      // 如果传入的路径是文件路径，相对后会为空，这时直接使用文件路径作为key
      const imgPath = path.relative(path.join(dir), el) || el;
      // 对比md5，判断图片是否已经被压缩，如果开启force，则一定压缩
      const isMin = this.isMin(el);
      if (force || !isMin) {
        const { data, ratio, flag } = fn(buffer, { quality: isNaN(+quality) ? 100 : +quality });
        if (!flag) {
          console.log(`${imgPath}压缩报错，放弃压缩`);
          // 记录压缩报错个数
          count.error += 1;
          this.log({}, count);
          continue;
        }
        const ext = path.extname(el);
        const newDir = path.join(
          path.dirname(el),
          path.basename(el).replace(ext, `.kuma_origin${ext}`)
        );
        console.log(`压缩${imgPath}...`);
        if (ratio < 1) {
          // 如果有原始文件，则删除
          fs.removeSync(newDir);
          // 如果需要备份，生成新的原始文件
          backup && fs.copySync(el, newDir);
          fs.writeFileSync(el, data);
          const dot = (100 - ratio * 100).toFixed(2);
          console.log(`压缩率${dot}%`);
          list[el] = md5(data);
          // 合计压缩前大小
          count.preLen += buffer.length;
          // 合计压缩后大小
          count.nextLen += data.length;
          // 如果源文件大于最大值，记录
          if (buffer.length > count.max) count.max = buffer.length;
          // 如果源文件小于最小值，记录
          if (count.min === 0 || buffer.length < count.min) count.min = buffer.length;
          // 如果压缩率大于最佳值，记录
          if (+dot > count.best) count.best = +dot;
          // 压缩总数
          count.total += 1;
        } else {
          // 记录放弃压缩个数
          console.log(`压缩率小于0，放弃压缩`);
          list[el] = md5(buffer);
          count.quit += 1;
        }
        this.log(list, count);
      } else if (isMin) {
        console.log(`${imgPath}已被压缩，忽略`);
      }
    }
  }
};

/**
 * 清除源文件
 *
 * @param {String} dir 需要清除源文件的文件夹路径
 */
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

/**
 * 用源文件还原压缩后的文件
 *
 * @param {String} dir 需要还原源文件的文件夹路径
 */
exports.resetByOrigin = async dir => {
  const fileObj = file(dir, {
    loop: true,
  });
  const keys = Object.keys(fileObj);
  for (let i = 0; i < keys.length; i++) {
    // 替换所有 \ 保证兼容window路径
    const el = fileObj[keys[i]].replace(/\\/g, '\\\\');
    const { name, ext } = path.parse(el);
    /(kuma_origin)$/.test(name) &&
      fs.moveSync(el, `${name.replace(/(kuma_origin)$/, '')}${ext}`, { overwrite: true });
  }
};

/**
 * 清除日志记录文件
 */
exports.clearLog = async () => {
  fs.removeSync(path.join(workDir, 'kuma-imagemin.log'));
};
