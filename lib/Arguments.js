import Iterable from './Iterable.js';

export default class Arguments extends Iterable {
	add(...items) {
		for(const item of items)
			if(typeof item !== 'string')
				throw new TypeError('all items must be a string.');
		super.add(...items);
	}
}
