import { EventEmitter } from 'events';

export default class Iterable extends EventEmitter {
	#items = [];
	get items() {
		return this.#items.slice(0);
	}
	add(...items) {
		this.#items.push(...items);
		this.emit('add', ...items);
	}
	remove(...items) {
		const removed = [];
		for(const item of items)
			removed.push(this.#items.splice(this.#items.indexOf(item), 1));
		this.emit('remove', ...items);
	}
	clear() {
		this.#items.length = 0;
	}
	get(index) {
		return this.#items[index];
	}
	[Symbol.iterator]() {
		let index = 0;

		return {
			next: () => {
				if (index < this.items.length) {
					return {
						value: this.items[index++],
						done: false
					};
				}
				else {
					return {
						done: true
					};
				}
			}
		};
	}
	static fromArgs(...args) {
		const iterable  = new this();
		iterable.add(...args);
		return iterable;
	}
}
