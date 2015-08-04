
'use strict';

var localVideo = document.querySelector('video#local')
var remoteVideo = document.querySelector('video#remote')
var start = document.querySelector('#start')
var call = document.querySelector('#call')
var answer = document.querySelector('#answer')
var chat = document.querySelector('#chat')
var chatBuffer = []
var localPC;
var remotePC;
var sendChannel;
var local;
var remote;

start.disabled = false;
call.disabled = true;
answer.disabled = true;
hangup.disabled = true;

function sayOk(x) {
  console.log("OK")
  if (x) { console.log(x) }
}

function sayError(x) {
  console.log("ERROR")
  if (x) { console.log(x) }
}

function other(id) {
  return (1 - id) + 2
}

function getter(id, pc) {
  getData(id,function(signal) {
    var callback = sayOk
    if (signal.type == "offer") callback = function() {
      console.log("Sending Answer")
      pc.createAnswer(function(answer) {
        // answer setting local
        console.log("Setting Local")
        pc.setLocalDescription(answer,function() {
          putData(other(id), answer, sayOk)
        },sayError)
      }, sayError); 
    }
    if (signal.sdp) {
      // caller or answerer setting remote desc
      console.log("Setting Remote")
      pc.setRemoteDescription(new RTCSessionDescription(signal), callback, sayError)
    } else if (signal.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(signal));
    }
    getter(id, pc)
  })
}

function getData(id,handler) {
  $.ajax("/call/"+id, {
    contentType: "application/json; charset=UTF-8",
    method: "get",
    dataType: "json",
    success: handler,
    error: sayError
  });
}

function putData(id,data,succ) {
  var body = JSON.stringify(data)
  $.ajax("/call/"+id, {
    contentType: "application/json; charset=UTF-8",
    method: "put",
    data: JSON.stringify(data),
    success: succ,
    error: sayError
  });
}

function mkIceCallback(id) {
  return function iceCallback(event) {
    if (event.candidate) {
      putData(id,event.candidate)
    }
  }
}

answer.onclick = function() {
  answer.disabled = true;
  //var config = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
  var config = null
  remotePC = new RTCPeerConnection(config)
  remotePC.onicecandidate = mkIceCallback(1);

  remotePC.onconnecting   = function() { console.log("answer:onconnecting") }
  remotePC.onopen         = function() { console.log("answer:onopen") }
  remotePC.onaddstream    = function(event) {
    console.log("answer:onRemoteStreamAdded") 
    remoteVideo.src = URL.createObjectURL(event.stream);
    console.log("videoURL: " + remoteVideo.src)
  }
  remotePC.onremovestream = function() { console.log("answer:onRemoteStreamRemoved") }
  remotePC.ondatachannel  = function(event) { console.log("answer:DATA!"); console.log(event) 
    window.remoteChannel = event.channel
    event.channel.onmessage = function(event) {
      console.log("answer:I got a message!")
      console.log(event)
      chatBuffer.push(event.data)
      chat.innerHTML = chatBuffer.join("\n")
    }
    event.channel.send("hello!")
    event.channel.send("how are you")
    event.channel.send("WebRTC data channel")
  }

  getter(2, remotePC)
}

call.onclick = function() {
  call.disabled = true;
  answer.disabled = true;

  console.log('Using video device: ' + window.stream.getVideoTracks()[0].label);
  console.log('Using audio device: ' + window.stream.getAudioTracks()[0].label);

  var servers = null
  localPC = new RTCPeerConnection(servers)
  localPC.onicecandidate = mkIceCallback(2);

  localPC.onconnecting   = function() { console.log("call:onconnecting") }
  localPC.onopen         = function() { console.log("call:onopen") }
  localPC.onaddstream    = function() { console.log("call:onRemoteStreamAdded") }
  localPC.onremovestream = function() { console.log("call:onRemoteStreamRemoved") }
  localPC.ondatachannel  = function(event) { console.log("call:DATA!"); console.log(event) 
    event.channel.onmessage = function(event) {
      console.log("call:I got a message!")
      console.log(event)
      chatBuffer.push(event.data)
      chat.innerHTML = chatBuffer.join("\n")
    }
    event.channel.send("call:hello!")
  }

  getter(1,localPC)

  localPC.addStream(window.stream) 
  sendChannel = localPC.createDataChannel("datachannel1");
  sendChannel.onmessage = function(event) {
    console.log("init:I got a message!")
    console.log(event)
    chatBuffer.push(event.data)
    chat.innerHTML = chatBuffer.join("\n")
  }

  // OFFER
  localPC.createOffer(function(desc) {
    // Caller setting local
    localPC.setLocalDescription(desc, function() {
      putData(2, desc, sayOk)
    }, sayError);
  },sayError);
}

hangup.onclick = function() {
  localPC.close();
  remotePC.close();
  localPC = null;
  remotePC = null;
  hangup.disabled = true;
  call.disabled = false;
  answer.disabled = true;
}

start.onclick = function() {
  start.disabled = true;
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

  navigator.getUserMedia({video: true, audio: true}, function(localMediaStream) {
    window.stream = localMediaStream; 
    localVideo.src = window.URL.createObjectURL(localMediaStream);
    console.log("videoURL: " + localVideo.src)
//    localVideo.play();
    call.disabled = false;
    answer.disabled = false;
  }, sayError);

  console.log("end...")
}
