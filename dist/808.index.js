"use strict";
exports.id = 808;
exports.ids = [808];
exports.modules = {

/***/ 56310:
/***/ ((module) => {



var has = Object.prototype.hasOwnProperty
  , prefix = '~';

/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */
function Events() {}

//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
  Events.prototype = Object.create(null);

  //
  // This hack is needed because the `__proto__` property is still inherited in
  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
  //
  if (!new Events().__proto__) prefix = false;
}

/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */
function addListener(emitter, event, fn, context, once) {
  if (typeof fn !== 'function') {
    throw new TypeError('The listener must be a function');
  }

  var listener = new EE(fn, context || emitter, once)
    , evt = prefix ? prefix + event : event;

  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
  else emitter._events[evt] = [emitter._events[evt], listener];

  return emitter;
}

/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */
function clearEvent(emitter, evt) {
  if (--emitter._eventsCount === 0) emitter._events = new Events();
  else delete emitter._events[evt];
}

/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */
function EventEmitter() {
  this._events = new Events();
  this._eventsCount = 0;
}

/**
 * Return an array listing the events for which the emitter has registered
 * listeners.
 *
 * @returns {Array}
 * @public
 */
EventEmitter.prototype.eventNames = function eventNames() {
  var names = []
    , events
    , name;

  if (this._eventsCount === 0) return names;

  for (name in (events = this._events)) {
    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
  }

  if (Object.getOwnPropertySymbols) {
    return names.concat(Object.getOwnPropertySymbols(events));
  }

  return names;
};

/**
 * Return the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Array} The registered listeners.
 * @public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  var evt = prefix ? prefix + event : event
    , handlers = this._events[evt];

  if (!handlers) return [];
  if (handlers.fn) return [handlers.fn];

  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
    ee[i] = handlers[i].fn;
  }

  return ee;
};

/**
 * Return the number of listeners listening to a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Number} The number of listeners.
 * @public
 */
EventEmitter.prototype.listenerCount = function listenerCount(event) {
  var evt = prefix ? prefix + event : event
    , listeners = this._events[evt];

  if (!listeners) return 0;
  if (listeners.fn) return 1;
  return listeners.length;
};

/**
 * Calls each of the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Boolean} `true` if the event had listeners, else `false`.
 * @public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return false;

  var listeners = this._events[evt]
    , len = arguments.length
    , args
    , i;

  if (listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Add a listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  return addListener(this, event, fn, context, false);
};

/**
 * Add a one-time listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  return addListener(this, event, fn, context, true);
};

/**
 * Remove the listeners of a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn Only remove the listeners that match this function.
 * @param {*} context Only remove the listeners that have this context.
 * @param {Boolean} once Only remove one-time listeners.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return this;
  if (!fn) {
    clearEvent(this, evt);
    return this;
  }

  var listeners = this._events[evt];

  if (listeners.fn) {
    if (
      listeners.fn === fn &&
      (!once || listeners.once) &&
      (!context || listeners.context === context)
    ) {
      clearEvent(this, evt);
    }
  } else {
    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
      if (
        listeners[i].fn !== fn ||
        (once && !listeners[i].once) ||
        (context && listeners[i].context !== context)
      ) {
        events.push(listeners[i]);
      }
    }

    //
    // Reset the array, or remove it completely if we have no more listeners.
    //
    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
    else clearEvent(this, evt);
  }

  return this;
};

/**
 * Remove all listeners, or those of the specified event.
 *
 * @param {(String|Symbol)} [event] The event name.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  var evt;

  if (event) {
    evt = prefix ? prefix + event : event;
    if (this._events[evt]) clearEvent(this, evt);
  } else {
    this._events = new Events();
    this._eventsCount = 0;
  }

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;

//
// Allow `EventEmitter` to be imported as module namespace.
//
EventEmitter.EventEmitter = EventEmitter;

//
// Expose the module.
//
if (true) {
  module.exports = EventEmitter;
}


/***/ }),

/***/ 77808:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "AbortError": () => (/* binding */ dist_AbortError),
  "default": () => (/* binding */ PQueue)
});

// EXTERNAL MODULE: ./node_modules/eventemitter3/index.js
var eventemitter3 = __webpack_require__(56310);
;// CONCATENATED MODULE: ./node_modules/p-queue/node_modules/p-timeout/index.js
class TimeoutError extends Error {
	constructor(message) {
		super(message);
		this.name = 'TimeoutError';
	}
}

/**
An error to be thrown when the request is aborted by AbortController.
DOMException is thrown instead of this Error when DOMException is available.
*/
class AbortError extends Error {
	constructor(message) {
		super();
		this.name = 'AbortError';
		this.message = message;
	}
}

/**
TODO: Remove AbortError and just throw DOMException when targeting Node 18.
*/
const getDOMException = errorMessage => globalThis.DOMException === undefined ?
	new AbortError(errorMessage) :
	new DOMException(errorMessage);

/**
TODO: Remove below function and just 'reject(signal.reason)' when targeting Node 18.
*/
const getAbortedReason = signal => {
	const reason = signal.reason === undefined ?
		getDOMException('This operation was aborted.') :
		signal.reason;

	return reason instanceof Error ? reason : getDOMException(reason);
};

function pTimeout(promise, milliseconds, fallback, options) {
	let timer;

	const cancelablePromise = new Promise((resolve, reject) => {
		if (typeof milliseconds !== 'number' || Math.sign(milliseconds) !== 1) {
			throw new TypeError(`Expected \`milliseconds\` to be a positive number, got \`${milliseconds}\``);
		}

		if (milliseconds === Number.POSITIVE_INFINITY) {
			resolve(promise);
			return;
		}

		options = {
			customTimers: {setTimeout, clearTimeout},
			...options
		};

		if (options.signal) {
			const {signal} = options;
			if (signal.aborted) {
				reject(getAbortedReason(signal));
			}

			signal.addEventListener('abort', () => {
				reject(getAbortedReason(signal));
			});
		}

		timer = options.customTimers.setTimeout.call(undefined, () => {
			if (typeof fallback === 'function') {
				try {
					resolve(fallback());
				} catch (error) {
					reject(error);
				}

				return;
			}

			const message = typeof fallback === 'string' ? fallback : `Promise timed out after ${milliseconds} milliseconds`;
			const timeoutError = fallback instanceof Error ? fallback : new TimeoutError(message);

			if (typeof promise.cancel === 'function') {
				promise.cancel();
			}

			reject(timeoutError);
		}, milliseconds);

		(async () => {
			try {
				resolve(await promise);
			} catch (error) {
				reject(error);
			} finally {
				options.customTimers.clearTimeout.call(undefined, timer);
			}
		})();
	});

	cancelablePromise.clear = () => {
		clearTimeout(timer);
		timer = undefined;
	};

	return cancelablePromise;
}

;// CONCATENATED MODULE: ./node_modules/p-queue/dist/lower-bound.js
// Port of lower_bound from https://en.cppreference.com/w/cpp/algorithm/lower_bound
// Used to compute insertion index to keep queue sorted after insertion
function lowerBound(array, value, comparator) {
    let first = 0;
    let count = array.length;
    while (count > 0) {
        const step = Math.trunc(count / 2);
        let it = first + step;
        if (comparator(array[it], value) <= 0) {
            first = ++it;
            count -= step + 1;
        }
        else {
            count = step;
        }
    }
    return first;
}

;// CONCATENATED MODULE: ./node_modules/p-queue/dist/priority-queue.js
var __classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _PriorityQueue_queue;

class PriorityQueue {
    constructor() {
        _PriorityQueue_queue.set(this, []);
    }
    enqueue(run, options) {
        options = {
            priority: 0,
            ...options,
        };
        const element = {
            priority: options.priority,
            run,
        };
        if (this.size && __classPrivateFieldGet(this, _PriorityQueue_queue, "f")[this.size - 1].priority >= options.priority) {
            __classPrivateFieldGet(this, _PriorityQueue_queue, "f").push(element);
            return;
        }
        const index = lowerBound(__classPrivateFieldGet(this, _PriorityQueue_queue, "f"), element, (a, b) => b.priority - a.priority);
        __classPrivateFieldGet(this, _PriorityQueue_queue, "f").splice(index, 0, element);
    }
    dequeue() {
        const item = __classPrivateFieldGet(this, _PriorityQueue_queue, "f").shift();
        return item === null || item === void 0 ? void 0 : item.run;
    }
    filter(options) {
        return __classPrivateFieldGet(this, _PriorityQueue_queue, "f").filter((element) => element.priority === options.priority).map((element) => element.run);
    }
    get size() {
        return __classPrivateFieldGet(this, _PriorityQueue_queue, "f").length;
    }
}
_PriorityQueue_queue = new WeakMap();

;// CONCATENATED MODULE: ./node_modules/p-queue/dist/index.js
var __classPrivateFieldSet = (undefined && undefined.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var dist_classPrivateFieldGet = (undefined && undefined.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _PQueue_instances, _PQueue_carryoverConcurrencyCount, _PQueue_isIntervalIgnored, _PQueue_intervalCount, _PQueue_intervalCap, _PQueue_interval, _PQueue_intervalEnd, _PQueue_intervalId, _PQueue_timeoutId, _PQueue_queue, _PQueue_queueClass, _PQueue_pending, _PQueue_concurrency, _PQueue_isPaused, _PQueue_throwOnTimeout, _PQueue_doesIntervalAllowAnother_get, _PQueue_doesConcurrentAllowAnother_get, _PQueue_next, _PQueue_onResumeInterval, _PQueue_isIntervalPaused_get, _PQueue_tryToStartAnother, _PQueue_initializeIntervalIfNeeded, _PQueue_onInterval, _PQueue_processQueue, _PQueue_throwOnAbort, _PQueue_onEvent;



/**
The error thrown by `queue.add()` when a job is aborted before it is run. See `signal`.
*/
class dist_AbortError extends Error {
}
/**
Promise queue with concurrency control.
*/
class PQueue extends eventemitter3 {
    // TODO: The `throwOnTimeout` option should affect the return types of `add()` and `addAll()`
    constructor(options) {
        var _a, _b, _c, _d;
        super();
        _PQueue_instances.add(this);
        _PQueue_carryoverConcurrencyCount.set(this, void 0);
        _PQueue_isIntervalIgnored.set(this, void 0);
        _PQueue_intervalCount.set(this, 0);
        _PQueue_intervalCap.set(this, void 0);
        _PQueue_interval.set(this, void 0);
        _PQueue_intervalEnd.set(this, 0);
        _PQueue_intervalId.set(this, void 0);
        _PQueue_timeoutId.set(this, void 0);
        _PQueue_queue.set(this, void 0);
        _PQueue_queueClass.set(this, void 0);
        _PQueue_pending.set(this, 0);
        // The `!` is needed because of https://github.com/microsoft/TypeScript/issues/32194
        _PQueue_concurrency.set(this, void 0);
        _PQueue_isPaused.set(this, void 0);
        _PQueue_throwOnTimeout.set(this, void 0);
        /**
        Per-operation timeout in milliseconds. Operations fulfill once `timeout` elapses if they haven't already.
    
        Applies to each future operation.
        */
        Object.defineProperty(this, "timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        options = {
            carryoverConcurrencyCount: false,
            intervalCap: Number.POSITIVE_INFINITY,
            interval: 0,
            concurrency: Number.POSITIVE_INFINITY,
            autoStart: true,
            queueClass: PriorityQueue,
            ...options,
        };
        if (!(typeof options.intervalCap === 'number' && options.intervalCap >= 1)) {
            throw new TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${(_b = (_a = options.intervalCap) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : ''}\` (${typeof options.intervalCap})`);
        }
        if (options.interval === undefined || !(Number.isFinite(options.interval) && options.interval >= 0)) {
            throw new TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${(_d = (_c = options.interval) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ''}\` (${typeof options.interval})`);
        }
        __classPrivateFieldSet(this, _PQueue_carryoverConcurrencyCount, options.carryoverConcurrencyCount, "f");
        __classPrivateFieldSet(this, _PQueue_isIntervalIgnored, options.intervalCap === Number.POSITIVE_INFINITY || options.interval === 0, "f");
        __classPrivateFieldSet(this, _PQueue_intervalCap, options.intervalCap, "f");
        __classPrivateFieldSet(this, _PQueue_interval, options.interval, "f");
        __classPrivateFieldSet(this, _PQueue_queue, new options.queueClass(), "f");
        __classPrivateFieldSet(this, _PQueue_queueClass, options.queueClass, "f");
        this.concurrency = options.concurrency;
        this.timeout = options.timeout;
        __classPrivateFieldSet(this, _PQueue_throwOnTimeout, options.throwOnTimeout === true, "f");
        __classPrivateFieldSet(this, _PQueue_isPaused, options.autoStart === false, "f");
    }
    get concurrency() {
        return dist_classPrivateFieldGet(this, _PQueue_concurrency, "f");
    }
    set concurrency(newConcurrency) {
        if (!(typeof newConcurrency === 'number' && newConcurrency >= 1)) {
            throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${newConcurrency}\` (${typeof newConcurrency})`);
        }
        __classPrivateFieldSet(this, _PQueue_concurrency, newConcurrency, "f");
        dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_processQueue).call(this);
    }
    async add(function_, options = {}) {
        options = {
            timeout: this.timeout,
            throwOnTimeout: dist_classPrivateFieldGet(this, _PQueue_throwOnTimeout, "f"),
            ...options,
        };
        return new Promise((resolve, reject) => {
            dist_classPrivateFieldGet(this, _PQueue_queue, "f").enqueue(async () => {
                var _a;
                var _b, _c;
                __classPrivateFieldSet(this, _PQueue_pending, (_b = dist_classPrivateFieldGet(this, _PQueue_pending, "f"), _b++, _b), "f");
                __classPrivateFieldSet(this, _PQueue_intervalCount, (_c = dist_classPrivateFieldGet(this, _PQueue_intervalCount, "f"), _c++, _c), "f");
                try {
                    // TODO: Use options.signal?.throwIfAborted() when targeting Node.js 18
                    if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                        // TODO: Use ABORT_ERR code when targeting Node.js 16 (https://nodejs.org/docs/latest-v16.x/api/errors.html#abort_err)
                        throw new dist_AbortError('The task was aborted.');
                    }
                    let operation = function_({ signal: options.signal });
                    if (options.timeout) {
                        operation = pTimeout(Promise.resolve(operation), options.timeout);
                    }
                    if (options.signal) {
                        operation = Promise.race([operation, dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_throwOnAbort).call(this, options.signal)]);
                    }
                    const result = await operation;
                    resolve(result);
                    this.emit('completed', result);
                }
                catch (error) {
                    if (error instanceof TimeoutError && !options.throwOnTimeout) {
                        resolve();
                        return;
                    }
                    reject(error);
                    this.emit('error', error);
                }
                finally {
                    dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_next).call(this);
                }
            }, options);
            this.emit('add');
            dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_tryToStartAnother).call(this);
        });
    }
    async addAll(functions, options) {
        return Promise.all(functions.map(async (function_) => this.add(function_, options)));
    }
    /**
    Start (or resume) executing enqueued tasks within concurrency limit. No need to call this if queue is not paused (via `options.autoStart = false` or by `.pause()` method.)
    */
    start() {
        if (!dist_classPrivateFieldGet(this, _PQueue_isPaused, "f")) {
            return this;
        }
        __classPrivateFieldSet(this, _PQueue_isPaused, false, "f");
        dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_processQueue).call(this);
        return this;
    }
    /**
    Put queue execution on hold.
    */
    pause() {
        __classPrivateFieldSet(this, _PQueue_isPaused, true, "f");
    }
    /**
    Clear the queue.
    */
    clear() {
        __classPrivateFieldSet(this, _PQueue_queue, new (dist_classPrivateFieldGet(this, _PQueue_queueClass, "f"))(), "f");
    }
    /**
    Can be called multiple times. Useful if you for example add additional items at a later time.

    @returns A promise that settles when the queue becomes empty.
    */
    async onEmpty() {
        // Instantly resolve if the queue is empty
        if (dist_classPrivateFieldGet(this, _PQueue_queue, "f").size === 0) {
            return;
        }
        await dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_onEvent).call(this, 'empty');
    }
    /**
    @returns A promise that settles when the queue size is less than the given limit: `queue.size < limit`.

    If you want to avoid having the queue grow beyond a certain size you can `await queue.onSizeLessThan()` before adding a new item.

    Note that this only limits the number of items waiting to start. There could still be up to `concurrency` jobs already running that this call does not include in its calculation.
    */
    async onSizeLessThan(limit) {
        // Instantly resolve if the queue is empty.
        if (dist_classPrivateFieldGet(this, _PQueue_queue, "f").size < limit) {
            return;
        }
        await dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_onEvent).call(this, 'next', () => dist_classPrivateFieldGet(this, _PQueue_queue, "f").size < limit);
    }
    /**
    The difference with `.onEmpty` is that `.onIdle` guarantees that all work from the queue has finished. `.onEmpty` merely signals that the queue is empty, but it could mean that some promises haven't completed yet.

    @returns A promise that settles when the queue becomes empty, and all promises have completed; `queue.size === 0 && queue.pending === 0`.
    */
    async onIdle() {
        // Instantly resolve if none pending and if nothing else is queued
        if (dist_classPrivateFieldGet(this, _PQueue_pending, "f") === 0 && dist_classPrivateFieldGet(this, _PQueue_queue, "f").size === 0) {
            return;
        }
        await dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_onEvent).call(this, 'idle');
    }
    /**
    Size of the queue, the number of queued items waiting to run.
    */
    get size() {
        return dist_classPrivateFieldGet(this, _PQueue_queue, "f").size;
    }
    /**
    Size of the queue, filtered by the given options.

    For example, this can be used to find the number of items remaining in the queue with a specific priority level.
    */
    sizeBy(options) {
        // eslint-disable-next-line unicorn/no-array-callback-reference
        return dist_classPrivateFieldGet(this, _PQueue_queue, "f").filter(options).length;
    }
    /**
    Number of running items (no longer in the queue).
    */
    get pending() {
        return dist_classPrivateFieldGet(this, _PQueue_pending, "f");
    }
    /**
    Whether the queue is currently paused.
    */
    get isPaused() {
        return dist_classPrivateFieldGet(this, _PQueue_isPaused, "f");
    }
}
_PQueue_carryoverConcurrencyCount = new WeakMap(), _PQueue_isIntervalIgnored = new WeakMap(), _PQueue_intervalCount = new WeakMap(), _PQueue_intervalCap = new WeakMap(), _PQueue_interval = new WeakMap(), _PQueue_intervalEnd = new WeakMap(), _PQueue_intervalId = new WeakMap(), _PQueue_timeoutId = new WeakMap(), _PQueue_queue = new WeakMap(), _PQueue_queueClass = new WeakMap(), _PQueue_pending = new WeakMap(), _PQueue_concurrency = new WeakMap(), _PQueue_isPaused = new WeakMap(), _PQueue_throwOnTimeout = new WeakMap(), _PQueue_instances = new WeakSet(), _PQueue_doesIntervalAllowAnother_get = function _PQueue_doesIntervalAllowAnother_get() {
    return dist_classPrivateFieldGet(this, _PQueue_isIntervalIgnored, "f") || dist_classPrivateFieldGet(this, _PQueue_intervalCount, "f") < dist_classPrivateFieldGet(this, _PQueue_intervalCap, "f");
}, _PQueue_doesConcurrentAllowAnother_get = function _PQueue_doesConcurrentAllowAnother_get() {
    return dist_classPrivateFieldGet(this, _PQueue_pending, "f") < dist_classPrivateFieldGet(this, _PQueue_concurrency, "f");
}, _PQueue_next = function _PQueue_next() {
    var _a;
    __classPrivateFieldSet(this, _PQueue_pending, (_a = dist_classPrivateFieldGet(this, _PQueue_pending, "f"), _a--, _a), "f");
    dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_tryToStartAnother).call(this);
    this.emit('next');
}, _PQueue_onResumeInterval = function _PQueue_onResumeInterval() {
    dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_onInterval).call(this);
    dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_initializeIntervalIfNeeded).call(this);
    __classPrivateFieldSet(this, _PQueue_timeoutId, undefined, "f");
}, _PQueue_isIntervalPaused_get = function _PQueue_isIntervalPaused_get() {
    const now = Date.now();
    if (dist_classPrivateFieldGet(this, _PQueue_intervalId, "f") === undefined) {
        const delay = dist_classPrivateFieldGet(this, _PQueue_intervalEnd, "f") - now;
        if (delay < 0) {
            // Act as the interval was done
            // We don't need to resume it here because it will be resumed on line 160
            __classPrivateFieldSet(this, _PQueue_intervalCount, (dist_classPrivateFieldGet(this, _PQueue_carryoverConcurrencyCount, "f")) ? dist_classPrivateFieldGet(this, _PQueue_pending, "f") : 0, "f");
        }
        else {
            // Act as the interval is pending
            if (dist_classPrivateFieldGet(this, _PQueue_timeoutId, "f") === undefined) {
                __classPrivateFieldSet(this, _PQueue_timeoutId, setTimeout(() => {
                    dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_onResumeInterval).call(this);
                }, delay), "f");
            }
            return true;
        }
    }
    return false;
}, _PQueue_tryToStartAnother = function _PQueue_tryToStartAnother() {
    if (dist_classPrivateFieldGet(this, _PQueue_queue, "f").size === 0) {
        // We can clear the interval ("pause")
        // Because we can redo it later ("resume")
        if (dist_classPrivateFieldGet(this, _PQueue_intervalId, "f")) {
            clearInterval(dist_classPrivateFieldGet(this, _PQueue_intervalId, "f"));
        }
        __classPrivateFieldSet(this, _PQueue_intervalId, undefined, "f");
        this.emit('empty');
        if (dist_classPrivateFieldGet(this, _PQueue_pending, "f") === 0) {
            this.emit('idle');
        }
        return false;
    }
    if (!dist_classPrivateFieldGet(this, _PQueue_isPaused, "f")) {
        const canInitializeInterval = !dist_classPrivateFieldGet(this, _PQueue_instances, "a", _PQueue_isIntervalPaused_get);
        if (dist_classPrivateFieldGet(this, _PQueue_instances, "a", _PQueue_doesIntervalAllowAnother_get) && dist_classPrivateFieldGet(this, _PQueue_instances, "a", _PQueue_doesConcurrentAllowAnother_get)) {
            const job = dist_classPrivateFieldGet(this, _PQueue_queue, "f").dequeue();
            if (!job) {
                return false;
            }
            this.emit('active');
            job();
            if (canInitializeInterval) {
                dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_initializeIntervalIfNeeded).call(this);
            }
            return true;
        }
    }
    return false;
}, _PQueue_initializeIntervalIfNeeded = function _PQueue_initializeIntervalIfNeeded() {
    if (dist_classPrivateFieldGet(this, _PQueue_isIntervalIgnored, "f") || dist_classPrivateFieldGet(this, _PQueue_intervalId, "f") !== undefined) {
        return;
    }
    __classPrivateFieldSet(this, _PQueue_intervalId, setInterval(() => {
        dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_onInterval).call(this);
    }, dist_classPrivateFieldGet(this, _PQueue_interval, "f")), "f");
    __classPrivateFieldSet(this, _PQueue_intervalEnd, Date.now() + dist_classPrivateFieldGet(this, _PQueue_interval, "f"), "f");
}, _PQueue_onInterval = function _PQueue_onInterval() {
    if (dist_classPrivateFieldGet(this, _PQueue_intervalCount, "f") === 0 && dist_classPrivateFieldGet(this, _PQueue_pending, "f") === 0 && dist_classPrivateFieldGet(this, _PQueue_intervalId, "f")) {
        clearInterval(dist_classPrivateFieldGet(this, _PQueue_intervalId, "f"));
        __classPrivateFieldSet(this, _PQueue_intervalId, undefined, "f");
    }
    __classPrivateFieldSet(this, _PQueue_intervalCount, dist_classPrivateFieldGet(this, _PQueue_carryoverConcurrencyCount, "f") ? dist_classPrivateFieldGet(this, _PQueue_pending, "f") : 0, "f");
    dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_processQueue).call(this);
}, _PQueue_processQueue = function _PQueue_processQueue() {
    // eslint-disable-next-line no-empty
    while (dist_classPrivateFieldGet(this, _PQueue_instances, "m", _PQueue_tryToStartAnother).call(this)) { }
}, _PQueue_throwOnAbort = async function _PQueue_throwOnAbort(signal) {
    return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
            // TODO: Reject with signal.throwIfAborted() when targeting Node.js 18
            // TODO: Use ABORT_ERR code when targeting Node.js 16 (https://nodejs.org/docs/latest-v16.x/api/errors.html#abort_err)
            reject(new dist_AbortError('The task was aborted.'));
        }, { once: true });
    });
}, _PQueue_onEvent = async function _PQueue_onEvent(event, filter) {
    return new Promise(resolve => {
        const listener = () => {
            if (filter && !filter()) {
                return;
            }
            this.off(event, listener);
            resolve();
        };
        this.on(event, listener);
    });
};


/***/ })

};
;