export const FILE_OPERATION_INTERVAL = 100;
export const FILE_OPERATION_APPEND = 'append';
export const FILE_OPERATION_OVERWRITE = 'overwrite';
export const FILE_OPERATION_READ = 'read';
export const FILE_OPERATION_NOOP = () => {};
export const FILE_OPERATIONS = [
	FILE_OPERATION_APPEND,
	FILE_OPERATION_OVERWRITE,
	FILE_OPERATION_READ
];

export default class FileOperation {
	#data = null;
	#operation = null;
	#callback = null;
	constructor(data, operation, callback) {
		if(FILE_OPERATIONS.indexOf(operation) === -1)
			throw new TypeError('invalid file operation.');
		if(callback && typeof callback !== 'function')
			throw new TypeError('callback must be a function.');
		
		this.#data = data;
		this.#operation = operation;
		this.#callback = callback || FILE_OPERATION_NOOP;
	}
	get data() {
		return this.#data;
	}
	get operation() {
		return this.#operation;
	}
	get callback() {
		return this.#callback;
	}
}
