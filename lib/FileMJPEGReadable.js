import MJPEGReadable from './MJPEGReadable.js';

export default class FileMJPEGReadable extends MJPEGReadable {
	#file = null;

	constructor(captureInterval, file) {
		super(captureInterval);

		if(typeof file !== 'string')
			throw new TypeError('file must be a string.');
		
		this.#file = file;
		this.ffmpegInputArgs.length = 0;
		this.ffmpegInputArgs.push('-re', '-i', this.file);
	}
	get file() {
		return this.#file;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an object.');
		
		return new this(
			config.captureInterval,
			config.file
		);
	}
}