import MJPEGReadable from './MJPEGReadable.js';

export default class FileMJPEGReadable extends MJPEGReadable {
	#file = null;

	get file() {
		return this.#file;
	}
	set file(v) {
		if(typeof v !== 'string')
			throw new TypeError('file must be a string.');
		if(v.length === 0)
			throw new TypeError('file cannot be empty.');
		
		this.#file = v;
		this.inputArgs.clear();
		this.inputArgs.add('-re', '-i', this.file);

		if(this.running)
			this.restart();
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an object.');

		const obj = MJPEGReadable.fromObject.call(this, config);
		obj.file = config.file;

		return obj;
	}
}
