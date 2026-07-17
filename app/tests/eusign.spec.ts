// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Simulating browser environment variables/functions for Node/Vitest
// in case they are not initialized in JSDOM yet.
if (typeof window === 'undefined') {
  global.window = {} as any;
}

// Import EndUser from eusign.js
import * as EUSignModule from '../../public/eusign.js';
const EndUser = EUSignModule.EndUser;

describe('EUSign JS Connector (.p7s signing & other APIs)', () => {
  let parentElement: HTMLDivElement;
  let iframeElement: HTMLIFrameElement;
  let widget: any;

  beforeEach(() => {
    // 1. Prepare DOM container
    parentElement = document.createElement('div');
    parentElement.id = 'widget-container';
    document.body.appendChild(parentElement);

    // 2. Mock addEventListener to capture message listeners
    vi.spyOn(window, 'addEventListener');

    // 3. Initialize the EndUser widget connector
    widget = new EndUser(
      'widget-container',
      'widget-iframe',
      'https://eu.iit.com.ua/sign-widget/v20200922/',
      1 // ReadPKey form type
    );

    iframeElement = document.getElementById('widget-iframe') as HTMLIFrameElement;
    
    // 4. Mock the postMessage function on the iframe contentWindow
    if (iframeElement) {
      Object.defineProperty(iframeElement, 'contentWindow', {
        value: {
          postMessage: vi.fn()
        },
        writable: true,
        configurable: true
      });
    }
  });

  afterEach(() => {
    if (widget) {
      widget.destroy();
    }
    if (parentElement) {
      parentElement.remove();
    }
    vi.restoreAllMocks();
  });

  // Helper to simulate iframe response for a given postMessage mock call index
  const simulateIframeResponse = (callIndex: number, resultData: any) => {
    const postedMessage = (iframeElement.contentWindow!.postMessage as any).mock.calls[callIndex][0];
    const messageId = postedMessage.id;

    const mockMessageEvent = new MessageEvent('message', {
      origin: 'https://eu.iit.com.ua',
      data: {
        sender: 'EndUserSignWidget',
        reciever: 'EndUserSignWidgetConnector',
        id: messageId,
        result: resultData
      }
    });

    const messageListener = (window.addEventListener as any).mock.calls.find(
      (call: any) => call[0] === 'message'
    )[1];
    
    messageListener(mockMessageEvent);
  };

  it('should initialize and append the iframe to the parent container', () => {
    expect(iframeElement).not.toBeNull();
    expect(iframeElement.getAttribute('src')).toContain('https://eu.iit.com.ua/sign-widget/v20200922/');
    expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function), false);
  });

  // --- SIGNING TESTS ---

  it('should sign using CAdES-BES (detached) & DSTU-4145', async () => {
    const dataToSign = new Uint8Array([1, 2, 3, 4]);
    const mockSignatureB64 = 'MIIHhQYJKoZIhvcNAQcCoIIHdjCCB3ICAQExADALBgkqhkiG9w0BBwGgggdk...';

    const signPromise = widget.SignData(
      dataToSign,
      true, // external (detached) = true
      true, // asBase64String = true
      EndUser.SignAlgo.DSTU4145WithGOST34311,
      null,
      EndUser.SignType.CAdES_BES
    );

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'SignData',
        params: [dataToSign, true, true, 1, null, 1]
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, mockSignatureB64);
    const signature = await signPromise;
    expect(signature).toBe(mockSignatureB64);
  });

  it('should sign using CAdES-X-Long (attached) & ECDSA', async () => {
    const dataToSign = new Uint8Array([5, 6, 7, 8]);
    const mockAttachedSignature = new Uint8Array([9, 9, 9]);

    const signPromise = widget.SignData(
      dataToSign,
      false,
      false,
      EndUser.SignAlgo.ECDSAWithSHA,
      null,
      EndUser.SignType.CAdES_X_Long
    );

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'SignData',
        params: [dataToSign, false, false, 3, null, 16]
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, mockAttachedSignature);
    const signature = await signPromise;
    expect(signature).toEqual(mockAttachedSignature);
  });

  it('should support SignHash method for signing precomputed hashes', async () => {
    const hash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
    const mockSig = 'HASH_SIGNATURE';

    const signPromise = widget.SignHash(
      hash,
      true,
      EndUser.SignAlgo.ECDSAWithSHA,
      EndUser.SignType.CAdES_BES,
      null
    );

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'SignHash',
        params: [hash, true, 3, 1, null]
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, mockSig);
    const signature = await signPromise;
    expect(signature).toBe(mockSig);
  });

  // --- OTHER APIS ---

  it('should read private key and return certificate info', async () => {
    const mockCertsInfo = [{ subject: { CN: 'Іван Петренко' } }];

    const readPromise = widget.ReadPrivateKey();

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'ReadPrivateKey',
        params: []
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, mockCertsInfo);
    const certsInfo = await readPromise;
    expect(certsInfo).toEqual(mockCertsInfo);
  });

  it('should reset private key', async () => {
    const resetPromise = widget.ResetPrivateKey();

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'ResetPrivateKey',
        params: []
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, null);
    await resetPromise;
  });

  it('should envelop (encrypt) data', async () => {
    const dataToEncrypt = new Uint8Array([10, 20, 30]);
    const recipientCerts = [new Uint8Array([99])];
    const mockEnvelopedData = new Uint8Array([55, 66, 77]);

    const envelopPromise = widget.EnvelopData(
      recipientCerts,
      dataToEncrypt,
      true, // signData = true
      false, // asBase64String = false
      true // useDynamicKey = true
    );

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'EnvelopData',
        params: [recipientCerts, dataToEncrypt, true, false, true]
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, mockEnvelopedData);
    const res = await envelopPromise;
    expect(res).toEqual(mockEnvelopedData);
  });

  it('should develop (decrypt) data', async () => {
    const envelopedData = 'BASE64_ENVELOPED_DATA';
    const senderCert = new Uint8Array([88]);
    const mockDecryptedResult = { senderInfo: {}, data: new Uint8Array([1, 2, 3]) };

    const developPromise = widget.DevelopData(
      envelopedData,
      senderCert
    );

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'DevelopData',
        params: [envelopedData, senderCert]
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, mockDecryptedResult);
    const res = await developPromise;
    expect(res).toEqual(mockDecryptedResult);
  });

  it('should change own certificate status', async () => {
    const changeStatusPromise = widget.ChangeOwnCertificatesStatus(
      EndUser.CCSType.Revoke, // 1
      EndUser.RevocationReason.KeyCompromise // 1
    );

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'ChangeOwnCertificatesStatus',
        params: [1, 1]
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, null);
    await changeStatusPromise;
  });

  it('should register event listener and trigger callback on widget event', async () => {
    const mockListener = vi.fn();
    const eventType = EndUser.EventType.ConfirmKSPOperation; // 2

    const addListenerPromise = widget.AddEventListener(eventType, mockListener);

    expect(iframeElement.contentWindow!.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cmd: 'AddEventListener',
        params: [eventType]
      }),
      'https://eu.iit.com.ua/sign-widget/v20200922/'
    );

    simulateIframeResponse(0, null);
    await addListenerPromise;

    // Simulate an event arriving from the widget iframe (id = -2 represents events)
    const mockEventData = {
      type: eventType,
      url: 'https://confirm-url',
      qrImage: 'BASE64_QR',
      mobileAppName: 'Diia'
    };

    const mockMessageEvent = new MessageEvent('message', {
      origin: 'https://eu.iit.com.ua',
      data: {
        sender: 'EndUserSignWidget',
        reciever: 'EndUserSignWidgetConnector',
        id: -2, // Event identifier
        result: mockEventData
      }
    });

    const messageListener = (window.addEventListener as any).mock.calls.find(
      (call: any) => call[0] === 'message'
    )[1];
    
    messageListener(mockMessageEvent);

    expect(mockListener).toHaveBeenCalledWith(mockEventData);
  });
});
