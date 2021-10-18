import logo from './logo.svg';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { loadGoogleScript } from './GoogleLogin';
import {useEffect, useState, createRef} from 'react';
import DOMPurify from 'dompurify'


function deentitize(text) {
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&apos;/g, "'");
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/<div>/g, '\n<div>').replaceAll("<div><br /></div>", "").replace(/(\r\n|\r|\n){2,}/g, '$1\n');
    return text;
}

function getGoogleMessageText(message) {
    let text = '';

    const fromEmail = getGoogleMessageEmailFromHeader('from', message);
    const toEmail = getGoogleMessageEmailFromHeader('to', message);

    let part;
    if (message.payload.parts) {
        part = message.payload.parts.find((part) => part.mimeType === 'text/plain');
    }

    let encodedText;
    if (message.payload.parts && part && part.body.data) {
        encodedText = part.body.data;
    } else if (message.payload.body.data) {
        encodedText = message.payload.body.data;
    }

    if (encodedText) {
        const buff = new Buffer(encodedText, 'base64');
        text = buff.toString('UTF-8');
        text = deentitize(text);
    }

    // NOTE: We need to remove history of email.
    // History starts with line (example): 'On Thu, Apr 30, 2020 at 8:29 PM John Doe <john.doe@example.com> wrote:'
    //
    // We also don't know who wrote the last message in history, so we use the email that
    // we meet first: 'fromEmail' and 'toEmail'
    const fromEmailWithArrows = `<${fromEmail}>`;
    const toEmailWithArrows = `<${toEmail}>`;
    // NOTE: Check if email has history
    const isEmailWithHistory = (!!fromEmail && text.indexOf(fromEmailWithArrows) > -1) || (!!toEmail && text.indexOf(toEmailWithArrows) > -1);
    // if(toEmail == "fjdiod@yandex.ru")console.log("condition", text.indexOf(fromEmailWithArrows), text.indexOf(toEmailWithArrows), findFirstSubstring(fromEmailWithArrows, toEmailWithArrows, text));

    if (isEmailWithHistory) {
       // NOTE: First history email with arrows
       const historyEmailWithArrows = findFirstSubstring(fromEmailWithArrows, toEmailWithArrows, text);

       // NOTE: Remove everything after `<${fromEmail}>`
       text = text.substring(0, text.indexOf(historyEmailWithArrows) + historyEmailWithArrows.length);
       // NOTE: Remove line that contains `<${fromEmail}>`
       const fromRegExp = new RegExp(`^.*${historyEmailWithArrows}.*$`, 'mg');
       text = text.replace(fromRegExp, '');
    }
    // if(fromEmail == "fjdiod@yandex.ru")console.log(fromEmail,toEmail, text);

    text = text.trim()

    return text;
}


function getGoogleMessageEmailFromHeader(headerName, message) {
    // console.log(message.payload.headers[4].name, headerName, message.payload.headers[4].name === headerName)
    const header = message.payload.headers.find((header) => header.name.toLowerCase() === headerName);

    if (!header) {
        return null;
    }

    const headerValue = header.value; // John Doe <john.doe@example.com>
    if(headerName == "to") console.log("fun", header.value);
    let email = "";
    if(headerValue.includes('<') && headerValue.includes('>')){
        email = headerValue.substring(
            headerValue.lastIndexOf('<') + 1,
            headerValue.lastIndexOf('>')
        );}
        else {
          email = headerValue;
        }
    // console.log('HIT', email)

    return email; // john.doe@example.com
}


function findFirstSubstring(a, b, str) {
    if (str.indexOf(a) === -1) return b;
    if (str.indexOf(b) === -1) return a;

    return (str.indexOf(a) < str.indexOf(b))
        ? a
        : b; // NOTE: (str.indexOf(b) < str.indexOf(a))
}


const googleClientId = "445034520838-5m6togti69ps0fgq1oli1q6iecv868ed.apps.googleusercontent.com";

// function setContacts(gapi, setContacts) {
//   gapi.client.gmail.users.messages.list({userId: "me", q: "after:2021/10/12"}).then(
//     async (response) => {
//       var contacts = [];
//       for(let i = 0; i < response.messages.length; i++)
//       {
//         var msg = await gapi.client.gmail.users.messages.get(userId='me', id=response.messages[i]['id']);
//         for(let j = 0; j < msg.payload.headers.length; j++) {
//           if(msg.payload.headers[j].name == "From") contacts.push(msg.payload.headers[j].value)
//         }
//       }
//       console.log(contacts)
//     });
// }

export const getBody = (message, mimeType) => {
  let encodedBody = "";
  if (typeof message.parts === "undefined") {
    encodedBody = message.body.data;
  } else {
    encodedBody = getHTMLPart(message.parts, mimeType);
  }
  encodedBody = encodedBody
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/\s/g, "");
    console.log("body", encodedBody)
  return (window.atob(encodedBody));
};

const getHTMLPart = (arr, mimeType) => {
  for (let x = 0; x < arr.length; x++) {
    if (typeof arr[x].parts === "undefined") {
      if (arr[x].mimeType === mimeType) {
        return arr[x].body.data;
      }
    } else {
      return getHTMLPart(arr[x].parts, mimeType);
    }
  }
  return "";
};

const isHTML = str => {
  const doc = new DOMParser().parseFromString(str, "text/html");
  return Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
}


function processBody(msg) {
  //   let body = getBody(msg.result.payload, "text/html")
  // if (body === "") {
  //   body = getBody(msg.result.payload, "text/plain");
  //   body = body.replace(/(\r\n)+/g, '<br data-break="rn-1">').replace(/[\n\r]+/g, '<br data-break="nr">');
  // }

  // if (body !== "" && !isHTML(body)) {
  //   body = body.replace(/(\r\n)+/g, '<div data-break="rn-1" style="margin-bottom:10px"></div>').replace(/[\n\r]+/g, '<br data-break="nr">');
  // }
  // if(body.includes('HTML')) {
  //   return body;
  // }
  return getGoogleMessageText(msg.result);
}


function prepareMessageData(msg, email) {
  console.log("COMMMMMMMMMPPP", msg.result)
  const fromEmail = getGoogleMessageEmailFromHeader('from', msg.result);
  const toEmail = getGoogleMessageEmailFromHeader('to', msg.result);
  const subject = getGoogleMessageEmailFromHeader('subject', msg.result);
  const inrepTo = getGoogleMessageEmailFromHeader('in-reply-to', msg.result);
  const msgId = getGoogleMessageEmailFromHeader('message-id', msg.result);
  let body = processBody(msg);
  let data = {body: body}
  let from = "";
  let to = "";
  let to2 = "";
  for(let j = 0; j < msg.result.payload.headers.length; j++) {
    if(msg.result.payload.headers[j].name.toLowerCase() == "from") from = msg.result.payload.headers[j].value;
    if(msg.result.payload.headers[j].name.toLowerCase() == "to") {to = msg.result.payload.headers[j].value; to2 = msg.result.payload.headers[j].value;}
    if(msg.result.payload.headers[j].name == "Date") {
  let dt = new Date(Date.parse(msg.result.payload.headers[j].value))
  dt = dt.toISOString()
  data['date'] = Date.parse(msg.result.payload.headers[j].value);
  data['date_str'] = dt; 
}
  }
  if(fromEmail == email) {
    from = toEmail;
  } else {
    to = from;
    data['side'] = 1;
    from = fromEmail;
  }
  console.log('COMPARE', subject, to, inrepTo, msgId)
  return [data, from, toEmail, to, subject, inrepTo, msgId];
}


function useGapi(setGapi, setGoogleAuth, setGClient, setIsLoggedIn, setName, setEmail, setImageUrl, setContacts, setConversations, setMailTo, setlastUpdate) {
  const onSuccess = (googleUser, gapi) => { // (Ref. 7)
    setIsLoggedIn(true);
    const profile = googleUser.getBasicProfile();
      let email = profile.getEmail();
    setName(profile.getName());
    setEmail(profile.getEmail());
    setImageUrl(profile.getImageUrl());
    // setContacts(['ASDAD', 'CCCCC']);
    // gapi.client.gmail.users.messages.list({userId: "me", q: "after:2021/10/12"}).then((response) => {console.log("ADASDASD")});
  gapi.client.gmail.users.messages.list({userId: "me", q: "after:" + (Date.parse("2021/10/01 00:00:00")/1000).toString()}).then(
    async (response) => {
      // await setEmail(profile.getEmail());
      var contacts = [];
      var data = {};
      let conversations = {};

      for(let i = 0; i < response.result.messages.length; i++)
      {
        if(!(response.result.messages[i]['id'] in messageSet)) messageSet[response.result.messages[i]['id']] = 1;
        var msg = await gapi.client.gmail.users.messages.get({userId: 'me', id:response.result.messages[i]['id']});
        let [data, from, toEmail, to, subject, inrepTo, msgId] = prepareMessageData(msg, email);
        data['id'] = response.result.messages[i]['id'];
        data['threadId'] = response.result.messages[i]['threadId'];
        data['previous'] = -1
        data['subject'] = subject;
        data['inrepTo'] = inrepTo;
        data['msgId'] = msgId;
        if(!(from in conversations)) {
          contacts.push(to)
          conversations[from] = [data]
          setContacts(Object.keys(conversations));
        } else {
          conversations[from].push(data);
        }
      }
      // sort conversation by date
      for(let i = 0; i < Object.keys(conversations).length; i++) {
        let conv = conversations[Object.keys(conversations)[i]]
        conversations[Object.keys(conversations)[i]] = conversations[Object.keys(conversations)[i]].sort((a, b) => {return a.date - b.date});
        if(conversations[Object.keys(conversations)[i]].length <= 1) continue;
        let previous = conversations[Object.keys(conversations)[i]][0]['threadId'];
        for(let j = 1; j < conversations[Object.keys(conversations)[i]].length; j++) {
          let threadId = conversations[Object.keys(conversations)[i]][j]['threadId'];
          if(threadId == previous) conversations[Object.keys(conversations)[i]][j]['previous'] = j-1;
          previous = threadId;
        }
      }
      setContacts(Object.keys(conversations))
      setConversations({...conversations});
      setMailTo(contacts);
      mailTo_ = [...contacts];
      conv = {...conversations};
    });
    let now = Math.round(Date.now()/1000);
    setlastUpdate(now);
    update = now;
    console.log('BEFOR UPDATES', messageSet)

    setInterval(() => {
      console.log('updating111');
      gapi.client.gmail.users.messages.list({userId: "me", q: "after:" + (update - 60).toString()}).then(
    async (response) => {
      // await setEmail(profile.getEmail());
      if(mailTo_.length == 0 || (Object.keys(conv) == 0)) {
        return;
      }
      var contacts = [...mailTo_];
      var data = {};
      let conversations = {...conv};
      console.log('updating222', response.result.resultSizeEstimate);
      console.log("upd comv", conv, update)
      if (response.result.resultSizeEstimate == 0) {
        console.log('EMPTY update');
        return;
      }
        console.log('IDS SET', "after:" + (update - 60).toString())
      console.log(response.result.messages)
      console.log(messageSet)
      for(let i = 0; i < response.result.messages.length; i++)
      {
        if(response.result.messages[i]['id'] in messageSet) {
          console.log('OLD MESSAGE');
          continue;
        }
        if(!(response.result.messages[i]['id'] in messageSet)) {
          console.log("NEW MESSAGE", response.result.messages[i])
          messageSet[response.result.messages[i]['id']] = 1;
        }
        var msg = await gapi.client.gmail.users.messages.get({userId: 'me', id:response.result.messages[i]['id']});
        let [data, from, toEmail, to, subject, inrepTo, msgId] = prepareMessageData(msg, email);
        data['id'] = response.result.messages[i]['id'];
        data['threadId'] = response.result.messages[i]['threadId'];
        data['previous'] = -1;
        data['subject'] = subject;
        data['inrepTo'] = inrepTo;
        data['msgId'] = msgId;
        if(!(from in conversations)) {
          contacts.push(to)
          conversations[from] = [data]
        } else {
          conversations[from].push(data);
        }
        // console.log("CONVERS", from, toEmail);
      }
      // sort conversations by date; todo: sort only the update
      for(let i = 0; i < Object.keys(conversations).length; i++) {
        let conv = conversations[Object.keys(conversations)[i]]
        conversations[Object.keys(conversations)[i]] = conversations[Object.keys(conversations)[i]].sort((a, b) => {return a.date - b.date});
        if(conversations[Object.keys(conversations)[i]].length <= 1) continue;
        let previous = conversations[Object.keys(conversations)[i]][0]['threadId'];
        for(let j = 1; j < conversations[Object.keys(conversations)[i]].length; j++) {
          let threadId = conversations[Object.keys(conversations)[i]][j]['threadId'];
          if(threadId == previous) conversations[Object.keys(conversations)[i]][j]['previous'] = j-1;
          previous = threadId;
        }
      }
      setContacts(Object.keys(conversations))
      setConversations({...conversations});
      setMailTo(contacts);
      mailTo_ = [...contacts]
      conv = {...conversations};
      console.log('updating final')
      let now = Math.round(Date.now()/1000);
      setlastUpdate(now);
      update = now;
    });
    }, 10000);

  };
  
  const onFailure = () => {
    setIsLoggedIn(false);
  }

  const renderSigninButton = (_gapi) => { // (Ref. 6)
    function tmp(googleUser) {
      return onSuccess(googleUser, _gapi)
    }
    _gapi.signin2.render('google-signin', {
      'scope': 'profile email',
      'width': 240,
      'height': 50,
      'longtitle': true,
      'theme': 'dark',
      'onsuccess': tmp,
      'onfailure': onFailure 
    });
  }

  useEffect(() => {
    

    // Window.gapi is available at this point
    window.onGoogleScriptLoad = () => { // (Ref. 1)
     
      const _gapi = window.gapi; // (Ref. 2)
      setGapi(_gapi);


    function initClient() {
   _gapi.client.init({
        // clientId and scope are optional if auth is not required.
        'discoveryDocs': ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"],
        'clientId': googleClientId,
        'scope': 'https://mail.google.com/',
      }).then(() => { // (Ref. 3)
        (async () => { 
          const _googleAuth = await _gapi.auth2.getAuthInstance({ // (Ref. 4)
           client_id: googleClientId
          });
          setGoogleAuth(_googleAuth); // (Ref. 5)
          renderSigninButton(_gapi); // (Ref. 6)
        })();
      });


  }

      _gapi.load('client:auth2', initClient);
    }
    
    // Ensure everything is set before loading the script
    loadGoogleScript(); // (Ref. 9)

    
  }, []);

  return [onSuccess, onFailure, renderSigninButton];
}

var state = 0;
var chosenMsg = -1;
var update = 0;
var mailTo_ = [];
var conv = {};
var messageSet = {};

var conversation = {
  'some@email.com': [{"side": 1, 'message': "Hello", 'date': '2021-09-10 00:00:00'}, {"side": 0, 'message': 'Hi', 'date': '2021-09-10 00:10:00'}]
}

function Contact(i, name, isChosen, setter, setChosenMsg) {
  var cls = "border"
  if(isChosen) cls = "border bg-primary";
  return <div class={cls} onClick={function() {state=i; setter(i); chosenMsg=-1; setChosenMsg(-1);}}>
              <p>{name}</p>
         </div>
}



function Contacts(names, value, setValue, isLoggedIn, setChosenMsg) {

//   useEffect(() => {
//     console.log('EFFECT in cont')
//     if(isLoggedIn) {
//     gapi.client.gmail.users.messages.list({userId: "me", q: "after:2021/10/12"}).then((response) => {console.log("ADASDASD")});
// }
//   }, []);
  var rows = []
  // const [value, setValue] = useState(1);
  var cls = "border bg-primary"
  for(let i = 0; i < names.length; i++) {
    rows.push(Contact(i, names[i], i == value, setValue, setChosenMsg)
             )
  }
  return rows
}


function getContacts(gapi) {

}


function select_state(x) {
  function tmp(e) {
    e.preventDefault();
    state = x;
  };
  return tmp;
}


function Message(msg, convers, ref_msg, ref_p, msgNum, setChosenMsg) {
  function onMsgClick() {
    console.log("CLICKING MSG", msgNum, chosenMsg);
    if(chosenMsg == msgNum) {
      chosenMsg = -1;
      setChosenMsg(-1);
    } else {
      chosenMsg = msgNum;
      setChosenMsg(msgNum);
    }
    console.log("CLICKING MSG after", msgNum, chosenMsg);
  }
  let cls = "col-md-8 message";
  if(msgNum == 0) {console.log("CLICKING MSG outer", msgNum, chosenMsg)};
  if(msgNum == chosenMsg) cls = "col-md-8 message bg-primary";
  if(msg.side == 1) {
  return <div className="d-flex flex-row">
             <div className="col-md-5 border">
             {
              msg.previous != -1 &&
              <div class="row">
                <div class="col-md-1"></div>
                <div class="col-md-5 text-truncate border-start"  onClick={() => {ref_p.current.scrollIntoView({ behavior: 'smooth' });}} dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(convers[msg.previous].body)}}></div>
              </div>
            }
               <div className="row">
                  <div class={msgNum == chosenMsg ? "col-md-8 message bg-primary": "col-md-8 message"} ref={ref_msg} onClick={onMsgClick} dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(msg.body)}}></div>
                  <div className="col-md-2 text-muted time-date">{msg.date_str.substring(5, 5+8)}</div>
               </div>
            </div>
         </div>
       }
  return <div className="d-flex flex-row-reverse">
             <div className="col-md-5 border">
             {
              msg.previous != -1 &&
              <div class="row">
                <div class="col-md-1"></div>
                <div class="col-md-5 text-truncate border-start" onClick={() => {ref_p.current.scrollIntoView({ behavior: 'smooth' }); console.log("SCROLLING")}}  dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(convers[msg.previous].body)}}></div>
              </div>
            }
               <div className="row">
                  <div class={msgNum == chosenMsg ? "col-md-8 message bg-primary": "col-md-8 message"} ref={ref_msg} onClick={onMsgClick} dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(msg.body)}}></div>
                  <div className="col-md-2 text-muted time-date">{msg.date_str.substring(5, 5+8)}</div>
               </div>
            </div>
         </div>
}

function Conversation(conversations, contacts_name, isLoggedIn, setChosenMsg) {
 let conv = []
 let refs = []
 // console.log("STRANGE CONV", conversations, contacts_name, state)
 if(isLoggedIn && (conversations != null) && (conversations[contacts_name[state]] != null))
 {
  console.log(state, contacts_name[state], contacts_name)
  for(let i = 0; i < conversations[contacts_name[state]].length;i++) {
    refs.push(createRef())
    if(conversations[contacts_name[state]][i].previous != -1){
        conv.push(Message(conversations[contacts_name[state]][i], conversations[contacts_name[state]], refs[i], refs[conversations[contacts_name[state]][i].previous], i, setChosenMsg));
      } else {
        conv.push(Message(conversations[contacts_name[state]][i], conversations[contacts_name[state]], refs[i], -1, i, setChosenMsg));
      }
  }
}
 return conv;
}

function sendMessage(gapi, headers, body) {
  let email = "";

  const headersClone = { ...headers };
  headersClone["Content-Type"] = "text/html; charset='UTF-8'";
  headersClone["Content-Transfer-Encoding"] = "base64";

  for (let header in headersClone) {
    email += `${header}: ${headersClone[header]}\r\n`;
  }

  email += `\r\n<html><body>${body}</body></html>`;
  const encodedEmail = unescape(encodeURIComponent(email));

  return gapi.client.gmail.users.messages.send({
    userId: "me",
    resource: {
      raw: window.btoa(encodedEmail).replace(/\+/g, "-").replace(/\//g, "_")
    }
  });
};

function App() {
  const [value, setValue] = useState(state);
  const [newContact, setNewContact] = useState("");
  const [chosenMsg, setChosenMsg] = useState(-1);
  const [gapi, setGapi] = useState();
  const [contacts_name, setContacts] = useState([]);
  const [googleAuth, setGoogleAuth] = useState();
  const [gclient, setGClient] = useState();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [imageUrl, setImageUrl] = useState();
  const [conversations, setConversations] = useState();
  const [message, setMessage] = useState("");
  const [mailTo, setMailTo] = useState([]);
  const [lastUpdate, setlastUpdate] = useState(0);

  const [onSuccess, onFailure, renderSigninButton] = useGapi(setGapi, setGoogleAuth, setGClient, setIsLoggedIn, setName, setEmail, setImageUrl, setContacts, setConversations, setMailTo, setlastUpdate);


  useEffect(() => {
    if(isLoggedIn) {
    setContacts(['asdad', 'fffff']);
}
  }, []);

  const logOut = () => { // (Ref. 8)
    (async() => {
      await googleAuth.signOut();
      setIsLoggedIn(false);
      renderSigninButton(gapi);
    })();
  };
  if (isLoggedIn && !(conversations == null)) {
    // console.log('LOGEDIN')
  }
  var names = ['some@email.com', 'other@email.com', 'my@email.com']
  // var contacts_ = Contacts(gapi, names, value, setValue)
  var x =     <div className="App">
        {!isLoggedIn &&
        <div id="google-signin"></div>
      }
{isLoggedIn &&
  <div className="container-fluid">
  <div className="row">
    <div className="col-md-4 border vh-100  px-0 pre-scrollable contacts">

      <h3>{email}</h3>
      <button className='btn-primary' onClick={logOut}>Log Out</button>
      <div class="input-group mb-3">
        <input type="text" class="form-control" placeholder="New contact" aria-label="New contact" aria-describedby="basic-addon2"  value={newContact} onChange={(event) => {setNewContact(event.target.value)}} />
        <div class="input-group-append">
          <button class="btn btn-outline-secondary" type="button" onClick={() => {
            setContacts([newContact, ...contacts_name]);
            let convers = {...conversations};
            convers[newContact] = [];
            // state = 0;
            setConversations(convers);
            mailTo_ = [newContact, ...mailTo]
            conv = {...convers};
            setMailTo([newContact, ...mailTo]);
          }
          }>+</button>
        </div>
      </div>
      {Contacts(contacts_name, value, setValue, isLoggedIn, setChosenMsg)}
      {/*<button className='btn-primary' onClick={logOut}>Log Out</button>*/}
    </div>
    <div className="col-md-8 border vh-100 px-0">
      <h3>{contacts_name[state]}</h3>
      
      <div className="container-fluid pre-scrollable conversation">
      {Conversation(conversations, contacts_name, isLoggedIn, setChosenMsg)}
      </div>
      <div class="navbar-fixed-bottom input-form">
        <div class="input-group">
          <textarea class="form-control" id="exampleFormControlTextarea1" rows="3" value={message} onChange={(event) => {setMessage(event.target.value); console.log('Texting', event.target.value)}}></textarea>
          <button onClick={() => {
            let headers = {};
            console.log("SEND", chosenMsg)
            if(chosenMsg != -1) {
                 console.log("SENDING WITH CHOSEN");
                 console.log(conv[contacts_name[state]][chosenMsg].subject, conv[contacts_name[state]][chosenMsg].inrepTo, conv[contacts_name[state]][chosenMsg].msgId);
                 headers = {
                  To: mailTo[state],
                  Subject: conv[contacts_name[state]][chosenMsg].subject,
                  "In-Reply-To": conv[contacts_name[state]][chosenMsg].msgId,
                  References: conv[contacts_name[state]][chosenMsg].msgId,
                  threadId: conv[contacts_name[state]][chosenMsg].threadId
                };
                console.log(headers);
              } else {
                 headers = {
                  To: mailTo[state],
                  Subject: "Subject"
                };
              }
            sendMessage(gapi, headers, message).then((resp) => {console.log('sucsess', resp)}, (reason) => {console.log('ERROR', reason)});
            setMessage("");
            console.log('Sending', headers)
          }}>Send</button>
        </div>
      </div>
    </div>
  </div>
  </div>}
    </div>

  return x;
}

export default App;
