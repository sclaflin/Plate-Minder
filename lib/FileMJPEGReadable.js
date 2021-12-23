import MJPEGReadable from './MJPEGReadable.js';

export default class FileMJPEGReadable extends MJPEGReadable {
	#file = null;

	constructor(name, captureInterval, file) {
		super(name, captureInterval);

		this.#file = file;
		this.ffmpegInputArgs.length = 0;
		this.ffmpegInputArgs.push('-re', '-i', this.file);
	}
	get file() {
		return this.#file;
	}
	set file(v) {
		if(typeof v !== 'string')
			throw new TypeError('file must be a string.');
		if(v.length === 0)
			throw new TypeError('file cannot be empty.');
		this.#file = v;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an object.');
		
		return new this(
			config.name,
			config.captureInterval,
			config.file
		);
	}
}
