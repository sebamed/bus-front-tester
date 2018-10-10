/* tslint:disable:variable-name max-line-length */

/**
 * @see https://github.com/shripalsoni04/nativescript-webview-interface/blob/master/www/nativescript-webview-interface.js
 */
export class NsWebViewInterface {
    /**
     * Mapping of native eventName and its handler in webView
     */
    public eventListenerMap = {};
  
    /**
     * Mapping of JS Call responseId and result for iOS
     */
    public _iosResponseMap = {};
  
    /**
     * Counter of iOS JS Call responseId
     */
    public _iosCntResponseId = 0;
  
    /**
     * Handles events/commands emitted by android/ios. This function is called from nativescript.
     * @param   {string}    eventName - Native event/command name
     * @param   {data}      data - Payload for the event/command
     */
    public _onNativeEvent(eventName: string, data: any) {
      const lstEvtListeners = this.eventListenerMap[eventName] || [];
  
      for (const listener of lstEvtListeners) {
        const retnVal = listener && listener(data);
        // if any handler return false, not executing any further handlers for that event.
        if (retnVal === false) {
          break;
        }
      }
    }
  
    /**
     * Handles JS function calls by android/ios. This function is called from nativescript.
     * Result value of JS function call can be promise or any other data.
     * @param   {number}    reqId - Internal communication id
     * @param   {string}    functionName - Function to be executed in webView
     * @param   {any[]}     args
     */
    public _callJSFunction(reqId: number, functionName: string, args: any[]) {
      const resolvedFn = this._getResolvedFunction(functionName);
      if (!resolvedFn) { return; }
  
      const retnVal = resolvedFn.apply(window, args);
      if (retnVal && retnVal.then) {
        retnVal.then(
          (value) => { this._sendJSCallResponse(reqId, value); },
          (error) => { this._sendJSCallResponse(reqId, error, true); },
        );
      } else {
        this._sendJSCallResponse(reqId, retnVal);
      }
    }
  
    /**
     * Resolves a function, if the function to be executed is in deep object chain.
     * e.g If we want to execute a function 'parent.child.child.fn' from native app,
     * this function will extract fn from the object chain.
     * We can do it by using eval also, but as there is a way, why to invite unknown security risks?
     *
     */
    public _getResolvedFunction(functionName: string): null | any {
      /* tslint:disable-next-line:no-conditional-assignment */
      if (functionName && (functionName = functionName.trim()).length) {
        functionName = functionName.indexOf('window.') === 0
          ? functionName.replace('window.', '')
          : functionName;
        const arrFnPath = functionName.split('.');
  
        let fn = window;
        for (const fnPathPart of arrFnPath) {
          if (!fn[fnPathPart]) {
            fn = null;
            break;
          }
          fn = fn[fnPathPart];
        }
  
        return fn;
      }
    }
  
    /**
     * Returns JS Call response by emitting internal _jsCallRespone event
     */
    public _sendJSCallResponse(reqId: number, response: any, isError?: boolean) {
      this.emit('_jsCallResponse', {
        reqId,
        response: response || null,
        isError: !!isError,
      });
    }
  
    /**
     * Creates temporary iFrame element to load custom url, for sending handshake message
     * to iOS which is necessary to initiate data transfer from webView to iOS
     */
    public _createIFrame(src) {
      const rootElm = document.documentElement;
      const newFrameElm = document.createElement('IFRAME');
  
      newFrameElm.setAttribute('src', src);
      rootElm.appendChild(newFrameElm);
  
      return newFrameElm;
    }
  
    /**
     * Sends handshaking signal to iOS using custom url, for sending event payload or JS Call response.
     * As iOS do not allow to send any data from webView. Here we are sending data in two steps.
     * 1. Send handshake signal, by loading custom url in iFrame with metadata (eventName, unique responseId)
     * 2. On intercept of this request, iOS calls _getIOSResponse with the responseId to fetch the data.
     */
    public _emitEventToIOS(eventName: string, data: any) {
      this._iosResponseMap[++this._iosCntResponseId] = data;
      const url = 'js2ios:' + JSON.stringify({
        eventName,
        resId: this._iosCntResponseId,
      });
  
      const iFrame = this._createIFrame(url);
      iFrame.parentNode.removeChild(iFrame);
    }
  
    /**
     * Returns data to iOS. This function is called from iOS.
     */
    public _getIOSResponse(resId: number) {
      const response = this._iosResponseMap[resId];
      delete this._iosResponseMap[resId];
      return response;
    }
  
    /**
     * Calls native android function to emit event and payload to android
     */
    public _emitEventToAndroid(eventName: string, data: any) {
      (window as any).androidWebViewInterface.handleEventFromWebView(eventName, data);
    }
  
    /**
     * Registers handlers for android/ios event/command
     */
    public on(eventName: string, callback: (data: any) => void) {
      const lstListeners = this.eventListenerMap[eventName] ||
        (this.eventListenerMap[eventName] = []);
  
      lstListeners.push(callback);
    }
  
    /**
     * Un-Registers handlers for android/ios event/command
     */
    public off(eventName: string, callback: (data: any) => void) {
      const listeners = this.eventListenerMap[eventName];
      const listenerIndex = listeners.indexOf(callback);
  
      if (-1 !== listenerIndex) {
        listeners.splice(listenerIndex);
      }
    }
  
    /**
     * Emits event to android/ios
     */
    public emit(eventName: string, data: any) {
      const strData = typeof data === 'object' ? JSON.stringify(data) : data;
  
      if ((window as any).androidWebViewInterface) {
        this._emitEventToAndroid(eventName, strData);
      } else {
        this._emitEventToIOS(eventName, strData);
      }
    }
  }