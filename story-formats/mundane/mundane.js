(function(window){

    const DEFAULTRATE 	= 180;
    const DEFAULTDELAY 	= 0;
    const DEFAULTVOICE = "Daniel";

    const extractLinksFromText = (text)=>{
        var links = text.match(/\[\[.+?\]\]/g);
        if (!links) {
            return null;
        }

        return links.map(function(link) {
        var differentName = link.match(/\[\[(.*?)\-\&gt;(.*?)\]\]/);
        if (differentName) {
            // [[name->link]]
            return {
            name: differentName[1],
            link: differentName[2]
            };
        } else {
            // [[link]]
            link = link.substring(2, link.length-2)
            return {
            name: link,
            link: link
            }
        }
        });
    }


    const extractPropsFromText = (text)=>{
        var props = {};
        var propMatch;
        var matchFound = false;
        const propRegexPattern = /\{\{((\s|\S)+?)\}\}((\s|\S)+?)\{\{\/\1\}\}/gm;
    
        while ((propMatch = propRegexPattern.exec(text)) !== null) {
          // The "key" of the prop, AKA the value wrapped in {{ }}.
          const key = propMatch[1];
    
          // Extract and sanitize the actual value.
          // This will remove any new lines.
          const value = propMatch[3].replace(/(\r\n|\n|\r)/gm, '');
    
          // We can nest props like so: {{foo}}{{bar}}value{{/bar}}{{/foo}},
          // so call this same method again to extract the values further.
          const furtherExtraction = this.extractPropsFromText(value);
    
          if (furtherExtraction !== null) {
            props[key] = furtherExtraction;
          } else {
            props[key] = value;
          }
    
          matchFound = true;
        }
    
        if (!matchFound) {
          return null;
        }
    
        return props;
    }

    const convertPassage = (passage)=>{
       
            var dict = {text: passage.innerHTML};
      
          var links = extractLinksFromText(dict.text);
          if (links) {
            dict.links = links;
          }
      
          const props = extractPropsFromText(dict.text);
          if (props) {
            dict.props = props;
          }
      
          ["name", "pid", "position", "tags"].forEach(function(attr) {
            var value = passage.attributes[attr].value;
            if (value) {
              dict[attr] = value;
            }
          });
      
          if(dict.position) {
            var position = dict.position.split(',')
            dict.position = {
              x: position[0],
              y: position[1]
            }
          }
      
          if (dict.tags) {
            dict.tags = dict.tags.split(" ");
          }
      
          return dict;
    };
      
    

    const convertStory = (story)=>{
        var passages = story.getElementsByTagName("tw-passagedata");
        var convertedPassages = Array.prototype.slice.call(passages).map(convertPassage);

        var dict = {
        passages: convertedPassages
        };

        ["name", "startnode", "creator", "creator-version", "ifid"].forEach(function(attr) {
        var value = story.attributes[attr].value;
        if (value) {
            dict[attr] = value;
        }
        });

        // Add PIDs to links
        var pidsByName = {};
        dict.passages.forEach(function(passage) {
        pidsByName[passage.name] = passage.pid;
        });

        dict.passages.forEach(function(passage) {
        if (!passage.links) return;
        passage.links.forEach(function(link) {
            link.pid = pidsByName[link.link];
            if (!link.pid) {
            link.broken = true;
            }
        });
        });

        return dict;
    }

    const extractType = (text)=>{
        const toks = text.split("\n");
        for (let i = 0; i < toks.length; i++){
            if (toks[i].indexOf("[type") != -1){
                const typetoks = toks[i].split(":");
                if (typetoks.length > 1)
                    return typetoks[1].replace("]","").trim();
                return "button";
            }
        }
        return "button";
    }

    const extractOnstart = (text) =>{
        if (text.indexOf("[onstart]") !== -1){
            return text.substring(text.indexOf("[onstart]")).split("[rules]")[0].replace("[onstart]","").trim();
        }
        return "";
    }
    
    const extractRulesText = (text) =>{
        if (text.indexOf("[rules]") !== -1){
            return text.substring(text.indexOf("[rules]")).replace("[rules]","").trim();
        }
        return "";
    }
    
    const parseSpeechLine = (line) =>{
        const tokens = line.replace("[speech]","").replace( /[()]/g,"").replace(/["]/g,"").trim().split(',');
        return {
            words:tokens.length > 0 ? tokens[0].trim(): "", 
            voice:tokens.length > 1 ? tokens[1].trim(): `${DEFAULTVOICE}`,
            rate:tokens.length  > 2 ? tokens[2].trim(): `${DEFAULTRATE}`, 
            delay:tokens.length > 3 ? tokens[3].trim(): `${DEFAULTDELAY}`
        }
    }
    
     //('query',('rotate',false','power','1','cool','true'))))
    const extractParams = (tuplestr) =>{
        const jsonstr = (tuplestr||"{}").replace(/[(]/g,"{").replace(/[)]/g,"}").replace(/[']/g,"\"");
        try{
            const result = JSON.parse(jsonstr);
            return result
        }catch(err){
            console.err("error parsing", jsonstr);
            return {}
        }
    }
    
   
    const extractParamsString = (str)=>{
        const toks = str.trim().substring(1, str.trim().length-1);
        const si = toks.indexOf("(");
        const ei = toks.lastIndexOf(")");
        return si > -1 && ei > -1 ? toks.substring(si,ei+1) : "";
    }

    const parseActionLine = (line) =>{
        const params = extractParamsString(line);
        const toks = line.replace(params,"").replace( /[()]/g,"").replace(/["]/g,"").trim().split(',');
        if (toks.length > 0){
            const jsonstr = (params||"{}").replace(/[(]/g,"{").replace(/[)]/g,"}").replace(/[']/g,"\"");
            console.log("parsing", jsonstr);
            console.log(JSON.parse(jsonstr));

            return {
                action: toks[0].startsWith("http") ? new URL(toks[0]):toks[0], 
                delay: toks.length > 1 ? Number(toks[1].trim()) : 0, 
                params: toks.length > 2 ? extractParams(params) : {},
                method: toks.length > 3 ? toks[2] === "POST" ? "POST" : "GET" : "" 
            }
        }
        return {action:""}
    }
    
    const extractSpeech = (text) =>{
        
        const toks = text.split('\n');
        let line = 0;
        let speech = [];
    
        const endCondition = (token)=>{
            return token.trim() === "" || token.indexOf("[") !== -1;
        }
        while (line < toks.length){
            if (toks[line].trim().startsWith("[speech]")){
                while (++line < toks.length){
                    if (!endCondition(toks[line])){
                        speech = [...speech, parseSpeechLine(toks[line])]
                    }else{
                        break;
                    }	
                }
            }
            line +=1;
        }
        return speech;
    }
    
    const extractActions = (text) =>{
    
    
        const toks = text.split('\n');
        let line = 0;
        let actions = [];
    
        const endCondition = (token)=>{
            return token.trim() === "" || token.indexOf("[") !== -1;
        }
    
    
        while (line < toks.length){
           
            if (toks[line].trim().startsWith("[action]")){
                let _actions = [];
                while (++line < toks.length){
                  
                    if (!endCondition(toks[line])){
                        _actions = [..._actions, parseActionLine(toks[line])]
                       
                    }else{
                       
                        break;
                    }	
                }
                actions = [...actions, _actions]
               
            }else{
                line +=1;
            }
        }
        return actions;
    }

    const simplifyOnstart = (onstart)=>{
        return Object.keys(onstart).reduce((acc, key)=>{
            if (key === "speech" && onstart[key] && onstart[key].length > 0){
                return {...acc, [key]: onstart[key]}
            }
            if (key === "actions" && onstart[key].length > 0 && onstart[key][0].length > 0){
                return {...acc, [key]: onstart[key].map(a=>simplifyActions(a))}
            }
            return acc;
        },{})
    }

    const simplifyAction = (a)=>{
        let action = {
            action: a.action,
        };

        if (a.params && Object.keys(a.params).length > 0){
            action = {
                ...action,
                params: a.params,
                method: a.method,
            }
        }
        if (a.delay !== undefined && a.delay > 0){
            action = {
                ...action,
                delay: a.delay
            }
        }
        return action;
    }
    const simplifyActions = (actions)=>{
        return actions.map(a=>simplifyAction(a));
    }

    const simplifyRules = (rules)=>{
        return rules.reduce((acc, rule)=>{
            return [...acc,{...rule, actions:rule.actions.map(a=>simplifyActions(a))}]
        },[]);
    }

    const simplify = (nodes)=>{
        return nodes.map(n=>{
            return Object.keys(n).reduce((acc, key)=>{
                if (key === "onstart"){
                    return {...acc, onstart:simplifyOnstart(n.onstart)}
                }
                if (key === "rules"){
                    return {...acc, rules:simplifyRules(n.rules)}
                }
                return {...acc, [key]:n[key]}
            },{});
        })
    }
    
    const parseRuleText = (text, type) =>{
        const [r, actions] = text.split('[actions]');
        const rtoks = r.replace("[[","").replace("]]","").split("|");
        const [operand=""] = rtoks[0].trim().split(" ");
        const next = rtoks.length > 1 ? rtoks[1] : operand;
        return  {
            type,
            rule:{
                operator: 'equals', 
                operand: operand.replace(/\s+/g,"")
            },
            actions : extractActions((actions||"").trim()),
            next: next.replace(/\s+/g,"")
        }
    }
    
    const extractRules = (text) =>{
        const toks = text.trim().replace("[rules]","").split('\n');
        let line = 0;
        let rules = [];
    
        const endCondition = (token)=>{
            return /*token.trim() === "" ||*/ token.indexOf("[rule") !== -1;
        }
        while (line < toks.length){
            if (toks[line].trim().startsWith("[rule")){
                let ruletxt = "";
                const [_,_type] = toks[line].replace("[","").replace("]","").split(":");
                const type = _type ? _type : "button";
               
                while (++line < toks.length){
                    if (!endCondition(toks[line])){
                        ruletxt += `\n${toks[line]}`;
                    }else{
                        break;
                    }	
                }
                rules = [...rules, parseRuleText(ruletxt.trim(), type)]
            }else{
                line +=1;
            }
        }
        return rules;
    }
    
    const convertToObject = (_name, text)=>{
        const name = _name.replace(/\s+/g,"");
        const type = extractType(text);
        const onstarttext = extractOnstart(text); 
        const speech = extractSpeech(onstarttext)
        const actions = extractActions(onstarttext);
        const rules = extractRules(extractRulesText(text));
    
        return {
            type,
            name,
            id:name,
            data: rules.map(r=>r.rule.operand),
            subscription: type === "speech" ? "/speech" : "/press",
            onstart : {
                speech,
                actions
            },
            rules
        }
    }

    var storyData = document.getElementsByTagName("tw-storydata")[0];
    var json = convertStory(storyData);
    console.log(json);


    const {passages, startnode, name} = json;

    const eligiblePassage = (text)=>{
        return text.indexOf("[onstart]" !== -1) || text.indexOf("[actions]") !== -1 || text.indexOf("[rules]") !== -1;
    }
    let event = "";

    const nodes = (passages||[]).reduce((acc, passage)=>{
        if (passage.pid === startnode){
            event = passage.name;
        }    
        if (passage.text && (passage.text.replace(/\s/g, '') !== "" && eligiblePassage(passage.text))){
            return [...acc,convertToObject(passage.name,passage.text)]
        }else{
            return acc;
        }
    },[]);

    const root = [{
        id: name,
        start: {
            actions: [[]],
            event,
        },
        events:simplify(nodes),
    }];
   
    const rootdom = document.createElement('pre');
    const output = document.createTextNode(JSON.stringify(root,null,4));
    rootdom.appendChild(output);
    document.body.appendChild(rootdom);
    //console.log("nodes are", nodes);

})(window);