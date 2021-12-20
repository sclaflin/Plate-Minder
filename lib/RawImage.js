import sharp from 'sharp';
import cv from './OpenCV.js';

export const channelsToMatType = {
	'1': cv.CV_8UC1,
	'2': cv.CV_8UC2,
	'3': cv.CV_8UC3,
	'4': cv.CV_8UC4
};

export default class RawImage {
	#buffer = null;
	#width = null;
	#height = null;
	#channels = null;

	constructor(buffer, width, height, channels) {
		this.buffer = buffer;
		this.width = width;
		this.height = height;
		this.channels = channels;
	}
	get buffer() {
		return this.#buffer;
	}
	set buffer(v) {
		if(!(v instanceof Buffer))
			throw new TypeError('buffer must be an instance of Buffer.');
		this.#buffer = v;
	}
	get width() {
		return this.#width;
	}
	set width(v) {
		if(!Number.isInteger(v))
			throw new TypeError('width must be an integer.');
		this.#width = v;
	}
	get height() {
		return this.#height;
	}
	set height(v) {
		if(!Number.isInteger(v))
			throw new TypeError('height must be an integer.');
		this.#height = v;
	}
	get channels() {
		return this.#channels;
	}
	set channels(v) {
		if(!Number.isInteger(v))
			throw new TypeError('channels must be an integer.');
		this.#channels = v;
	}
	clear() {
		this.buffer = Buffer.from([]);
		this.width = 0;
		this.height = 0;
		this.channels = 0;
	}
	async roi(left, top, width, height) {
		const img = sharp(
			this.buffer,
			{
				raw: {
					width: this.width,
					height: this.height,
					channels: this.channels
				}
			}
		)
			.extract({
				left,
				top,
				width,
				height
			});
		return RawImage.fromObject({
			buffer: await img.toBuffer(),
			width,
			height,
			channels: this.channels
		});
	}
	async crop(left, top, width, height) {
		const img = sharp(
			this.buffer,
			{
				raw: {
					width: this.width,
					height: this.height,
					channels: this.channels
				}
			}
		)
			.extract({
				left,
				top,
				width,
				height
			});

		this.buffer = await img.toBuffer();
		this.width = width;
		this.height = height;
	}
	toMat() {
		const mat = new cv.Mat(this.height, this.width, channelsToMatType[this.channels]);
		mat.data.set(this.buffer);
		return mat;
	}
	async toJpegBuffer() {
		if(this.buffer.length === 0)
			return this.buffer;

		return await sharp(
			this.buffer,
			{
				raw: {
					width: this.width,
					height: this.height,
					channels: this.channels
				}
			}
		)
			.jpeg({
				// quality: 100,
				// chromaSubsampling: '4:4:4'
			})
			.toBuffer();
	}
	loadMat(mat) {
		if(!(mat instanceof cv.Mat))
			throw new TypeError('mat must be an instance of cv.Mat.');
		this.buffer = Buffer.from(mat.data);
		this.width = mat.cols;
		this.height = mat.rows;
		this.channels = mat.channels();
	}
	static copy(rawImage) {
		if(!(rawImage instanceof RawImage))
			throw new TypeError('rawImage must be an instance of RawImage.');
		return new this(
			Buffer.from(rawImage.buffer),
			rawImage.width,
			rawImage.height,
			rawImage.channels
		);
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');

		return new this(
			config.buffer,
			config.width,
			config.height,
			config.channels
		);
	}
	static async fromBuffer(buffer) {
		const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
		return new this(
			data,
			info.width,
			info.height,
			info.channels
		);
	}
}