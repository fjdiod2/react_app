import logo from './logo.svg';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { loadGoogleScript } from './GoogleLogin';
import {useEffect, useState} from 'react';
import DOMPurify from 'dompurify'

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
        text = buff.toString('ascii');
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

    if (isEmailWithHistory) {
       // NOTE: First history email with arrows
       const historyEmailWithArrows = findFirstSubstring(fromEmailWithArrows, toEmailWithArrows, text);

       // NOTE: Remove everything after `<${fromEmail}>`
       text = text.substring(0, text.indexOf(historyEmailWithArrows) + historyEmailWithArrows.length);
       // NOTE: Remove line that contains `<${fromEmail}>`
       const fromRegExp = new RegExp(`^.*${historyEmailWithArrows}.*$`, 'mg');
       text = text.replace(fromRegExp, '');
    }

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
  return decodeURIComponent(escape(window.atob(encodedBody)));
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
    let body = getBody(msg.result.payload, "text/html")
  if (body === "") {
    body = getBody(msg.result.payload, "text/plain");
    body = body.replace(/(\r\n)+/g, '<br data-break="rn-1">').replace(/[\n\r]+/g, '<br data-break="nr">');
  }

  if (body !== "" && !isHTML(body)) {
    body = body.replace(/(\r\n)+/g, '<div data-break="rn-1" style="margin-bottom:10px"></div>').replace(/[\n\r]+/g, '<br data-break="nr">');
  }
  if(body.includes('HTML')) {
    return body;
  }
  return getGoogleMessageText(msg.result);
}


function prepareMessageData(msg, email) {
  const fromEmail = getGoogleMessageEmailFromHeader('from', msg.result);
  const toEmail = getGoogleMessageEmailFromHeader('to', msg.result);
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
  console.log('COMPARE', to)
  return [data, from, toEmail, to];
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
  gapi.client.gmail.users.messages.list({userId: "me", q: "after:" + Date.parse("2021/10/12 00:00:00")/1000}).then(
    async (response) => {
      // await setEmail(profile.getEmail());
      var contacts = [];
      var data = {};
      let conversations = {};

      for(let i = 0; i < response.result.messages.length; i++)
      {
        var msg = await gapi.client.gmail.users.messages.get({userId: 'me', id:response.result.messages[i]['id']});
        let [data, from, toEmail, to] = prepareMessageData(msg, email);
        if(!(from in conversations)) {
          contacts.push(to)
          conversations[from] = [data]
        } else {
          conversations[from].push(data);
        }
        // console.log("CONVERS", from, toEmail);
      }
      // console.log(conversations)
      for(let i = 0; i < Object.keys(conversations).length; i++) {
        let conv = conversations[Object.keys(conversations)[i]]
        conversations[Object.keys(conversations)[i]] = conversations[Object.keys(conversations)[i]].sort((a, b) => {return a.date - b.date});
      }
      setContacts(Object.keys(conversations))
      setConversations({...conversations});
      setMailTo(contacts);
      mailTo_ = contacts;
      conv = {...conversations};
      console.log('aaa', conversations[Object.keys(conversations)[0]])
    });
    let now = Date.now()/1000;
    setlastUpdate(now);
    update = now;

    setInterval(() => {
      console.log('updating111');
      gapi.client.gmail.users.messages.list({userId: "me", q: "after:" + Date.parse("2021/10/12 00:00:00")/1000}).then(
    async (response) => {
      // await setEmail(profile.getEmail());
      var contacts = [];
      var data = {};
      let conversations = {};
      console.log('updating222', response.result.resultSizeEstimate);
      console.log(conv, update)
      if (response.result.resultSizeEstimate == 0) {
        console.log('EMPTY update');
        return;
      }
      let now = Date.now()/1000;
        setlastUpdate(now);
        update = now;
      for(let i = 0; i < response.result.messages.length; i++)
      {
        var msg = await gapi.client.gmail.users.messages.get({userId: 'me', id:response.result.messages[i]['id']});
        let [data, from, toEmail, to] = prepareMessageData(msg, email);
        if(!(from in conversations)) {
          contacts.push(to)
          conversations[from] = [data]
        } else {
          conversations[from].push(data);
        }
        // console.log("CONVERS", from, toEmail);
      }
      // console.log(conversations)
      for(let i = 0; i < Object.keys(conversations).length; i++) {
        let conv = conversations[Object.keys(conversations)[i]]
        conversations[Object.keys(conversations)[i]] = conversations[Object.keys(conversations)[i]].sort((a, b) => {return a.date - b.date});
      }
      setContacts(Object.keys(conversations))
      setConversations({...conversations});
      setMailTo(contacts);
      mailTo_ = contacts
      conv = {...conversations};
      console.log('updating', conversations[Object.keys(conversations)[0]])
    });
    }, 20000);

   gapi.client.gmail.users.messages.get({userId: 'me', id: '17c790b6196be048'}).then((msg) => {
    let body = getBody(msg.result.payload, "text/html")
  if (body === "") {
    body = getBody(msg.result.payload, "text/plain");
    body = body.replace(/(\r\n)+/g, '<br data-break="rn-1">').replace(/[\n\r]+/g, '<br data-break="nr">');
  }

  if (body !== "" && !isHTML(body)) {
    body = body.replace(/(\r\n)+/g, '<div data-break="rn-1" style="margin-bottom:10px"></div>').replace(/[\n\r]+/g, '<br data-break="nr">');
  }
    console.log('body', body);
   }, (reason) => {console.log('ERROR')}) 
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
        'apiKey': 'AIzaSyBr0dvCycZQPXpl9jRvQ0lt-VGWaSzgil4',
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
var update = 0;
var mailTo_ = [];
var conv = {};

var conversation = {
  'some@email.com': [{"side": 1, 'message': "Hello", 'date': '2021-09-10 00:00:00'}, {"side": 0, 'message': 'Hi', 'date': '2021-09-10 00:10:00'}]
}

function Contact(i, name, isChosen, setter) {
  var cls = "border"
  if(isChosen) cls = "border bg-primary";
  return <div class={cls} onClick={function() {state=i; setter(i); }}>
              <p>{name}</p>
         </div>
}



function Contacts(names, value, setValue, isLoggedIn) {

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
    rows.push(Contact(i, names[i], i == value, setValue)
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


function Message(msg) {
  if(msg.side == 1) {
  return <div className="d-flex flex-row">
         <div className="col-md-5 border" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(msg.body)}}>
         </div>
         <div className="col-md-2 text-muted">{msg.date_str.substring(5, 5+8)}</div>
         </div>
       }
  return <div className="d-flex flex-row-reverse">
         <div className="col-md-5 border" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(msg.body)}}>
         </div>
         <div className="col-md-2 text-muted">{msg.date_str.substring(5, 5+8)}</div>
         </div>
}

function Conversation(conversations, contacts_name, isLoggedIn) {
 let conv = []
 if(isLoggedIn && (conversations != null)){
  for(let i = 0; i < conversations[contacts_name[state]].length;i++) {
    conv.push(Message(conversations[contacts_name[state]][i]))
  }}
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
    console.log('LOGEDIN')
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
    <div className="col-md-4 border vh-100  px-0">

      <h3>{email}</h3>
      <button className='btn-primary' onClick={logOut}>Log Out</button>
      {Contacts(contacts_name, value, setValue)}
      {/*<button className='btn-primary' onClick={logOut}>Log Out</button>*/}
    </div>
    <div className="col-md-8 border vh-100 px-0">
      <h3>{contacts_name[state]}</h3>
      
      <div className="container-fluid pre-scrollable conversation">
      {Conversation(conversations, contacts_name, isLoggedIn)}
      </div>
      <div class="navbar-fixed-bottom">
        <div class="input-group">
          <textarea class="form-control" id="exampleFormControlTextarea1" rows="3" onChange={(event) => {setMessage(event.target.value); console.log('Texting', event.target.value)}}></textarea>
          <button onClick={() => {
                const headers = {
                  To: mailTo[state],
                  Subject: "Subject"
                };
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
