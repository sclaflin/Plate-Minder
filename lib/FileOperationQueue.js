import fs from 'fs/promises';
import FileOperation, { 
	FILE_OPERATION_APPEND,
	FILE_OPERATION_OVERWRITE,
	FILE_OPERATION_READ
} from './FileOperation.js';

export default class FileOperationQueue {
	#file = null;
	#queue = [];
	#active = false;
	constructor(file) {
		this.file = file;
	}
	get file() {
		return this.#file;
	}
	set file(v) {
		if(typeof v !== 'string')
			throw new TypeError('file must be a string.');
		this.#file = v;
	}
	get queue() {
		return this.#queue.slice(0);
	}
	addOperation(operation) {
		if(!(operation instanceof FileOperation))
			throw new TypeError('operation must be an instance of FileOperation.');
		
		this.#queue.push(operation);
		if(!this.#active)
			this.next();
	}
	async next() {
		this.#active = true;
		while(this.#queue.length > 0) {
			const operation = this.#queue.shift();
			let handle = null;
			try {
				let data = null;
				switch (operation.operation) {
					case FILE_OPERATION_OVERWRITE: {
						handle = await fs.open(this.file, 'w');
						await handle.writeFile(operation.data);
						await handle.sync();
						break;
					}
					case FILE_OPERATION_APPEND: {
						handle = await fs.open(this.file, 'a');
						await handle.writeFile(operation.data);
						await handle.sync();
						break;
					}
					case FILE_OPERATION_READ: {
						handle = await fs.open(this.file, 'r');
						data = await handle.readFile();
						break;
					}
					default:
						throw new Error('Unknown file operation.');
				}
				await handle.close();
				handle = null;
				operation.callback(null, data);
			}
			catch(err) {
				if(handle)
					handle.close();
				operation.callback(err);
			}
		}
		this.#active = false;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		return new this(
			config.file
		);
	}
}
