import EventEmitter from 'events';

export default class PlateRecorder {
    record(data, jpeg) {
        throw new Error('Implement a record method here.');
    }
    static fromObject(config) {
        if(config === null || typeof config !== 'object')
            throw new TypeError('config must be an Object.');
        
        return new this();
    }
}