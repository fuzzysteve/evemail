/*!
 * Sections of code from https://github.com/jimpurbrick/crestexplorerjs
 *  Copyright 2012, CCP (http://www.ccpgames.com)
 *  Dual licensed under the MIT or GPL Version 2 licenses.
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.opensource.org/licenses/GPL-2.0
 *
 *  All other code is under the MIT license.
 *
*/

var characterId=0;
var characterName='';
var characterlist={};
var expires=0;
var sanitizer = {};
var countdown={};
var currentmail={};
var mailrecipients=[];
var labels={};
var mailingLists={};
var lowestMailId=Infinity;

    // Configuration parameters
    var redirectUri = "https://evemail.fuzzwork.co.uk/";
    var clientId = "98962eb6193047999a9ba0b12ded7aec"; // OAuth client id
    var csrfTokenName = clientId + "csrftoken";
    var hashTokenName = clientId + "hash";
    var scopes = "esi-mail.read_mail.v1 esi-mail.send_mail.v1";

    (function($) {
    function trimAttributes(node) {
        $.each(node.attributes, function() {
            var attrName = this.name;
            var attrValue = this.value;
            if (attrName.length>0){
                if (attrName.indexOf('on') === 0 || attrValue.indexOf('javascript:') === 0 || attrName.indexOf('size') === 0) {
                    $(node).removeAttr(attrName);
                }
                if (attrName == 'href' && attrValue.indexOf('showinfo') === 0) {
                    id=attrValue.substr(9,attrValue.indexOf('//')-9);
                    $(node)[0].href='https://www.fuzzwork.co.uk/info/?typeid='+id;
                    $(node)[0].target='_blank';
                }
            }
        });
    }

    function sanitize(html) {
        var output = $($.parseHTML('<div>' + html + '</div>', null, false));
        output.find('*').each(function() {
            trimAttributes(this);
        });
        return output.html();
    }

    sanitizer.sanitize = sanitize;
    })(jQuery);




    // Show error message in main data pane.
    function displayError(error) {
        $("#data").children().replaceWith("<span>" + error + "</span>");
    }

    // Send Oauth token request on login, reset ajax Authorization header on logout.
    function onClickLogin(evt) {
        evt.preventDefault();
        var command = $("#login").text();
        if (command === "Login to Start Reading and sending email") {

            // Store CSRF token and current location as cookie
            var csrfToken = uuidGen();
            $.cookie(csrfTokenName, csrfToken);
            $.cookie(hashTokenName, window.location.hash);

            // No OAuth token, request one from the OAuth authentication endpoint
            window.location =  "https://login.eveonline.com/oauth/authorize/" +
                "?response_type=token" +
                "&client_id=" + clientId +
                "&scope=" + scopes +
                "&redirect_uri=" + redirectUri +
                "&state=" + csrfToken;

        } else {
            ajaxSetup(false);
            loginSetup(false);
        }
    }

    // Extract value from oauth formatted hash fragment.
    function extractFromHash(name, hash) {
        var match = hash.match(new RegExp(name + "=([^&]+)"));
        return !!match && match[1];
    }

    // Generate an RFC4122 version 4 UUID
    function uuidGen() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    }

    function ajaxSetup(token) {
        var headers = {
            "Accept": "application/json, charset=utf-8"
        };
        if (token) {
            headers.Authorization = "Bearer " + token;
            headers['X-User-Agent'] = "evemail.fuzzwork.co.uk";
        }
        $.ajaxSetup({
            accepts: "application/json, charset=utf-8",
            crossDomain: true,
            type: "GET",
            dataType: "json",
            async: false,
            headers: headers,
            error: function (xhr, status, error) {
                displayError(error);
            }
        });
    }

    function loginSetup(token) {
        $("#login").click(onClickLogin);
    }

    $(document).ready(function() {

        var hash = window.location.hash;
        var token = extractFromHash("access_token", hash);
        expires=Date.now()+1200000;
        $("#mailHeaders").hide();
        $("#mailBody").hide();
        $("#menuBar").hide();

        if (token) {
            ajaxSetup(token);
            // Check CSRF token in state matches token saved in cookie
            if(extractFromHash("state", hash) !== $.cookie(csrfTokenName)) {
                displayError("CSRF token mismatch");
                return;
            }

            $.getJSON("https://esi.tech.ccp.is/verify/",function(data,status,xhr){ characterId=data.CharacterID; });



            // Restore hash.
            window.location.hash = $.cookie(hashTokenName);

            // Delete cookies.
            $.cookie(csrfTokenName, null);
            $.cookie(hashTokenName, null);
            countdown = setInterval(function() { $('#expiresTime').val(Math.floor((expires-Date.now())/1000));},1000);

            $("#login-window").hide();
            $("#menuBar").show();
            $("#faq").hide();
            $('#mailHeadersTable').DataTable({
              "paging": false,
              "scrollY": "40%",
              "bFilter": false,
              "bInfo": false,
              "autoWidth": true,
              "bSortClasses": false,
              "bDeferRender": false,
              "sDom": 'C<"clear">lfrtip',
              "order":[[2,"desc"]]
            });
            selectUser();

        } else {
        }

        loginSetup(token);
    });


    function onlyUnique(value, index, self) { 
        return self.indexOf(value) === index;
    }

    function idLookup(characterIds){
    
        var o,j,temparray,chunk = 10;
        for (o=0,j=characterIds.length; o < j; o+=chunk) {
            temparray = characterIds.slice(o,o+chunk);
            characters=JSON.stringify(temparray.filter(onlyUnique));
            $.ajax({url:"https://esi.tech.ccp.is/latest/universe/names/?datasource=tranquility",data:characters,success:function(data,status,xhr){
                  data.forEach(function(element) {
                          characterlist[element.id]=element.name; 
                  });
            },method:"POST",processData:false,contentType: 'application/json',async:false});
        }
    }
    function singleLookup(characterIds){
    
        var o,j,temparray,chunk = 5;
        for (o=0,j=characterIds.length; o < j; o+=chunk) {
            temparray = characterIds.slice(o,o+chunk);
            characters=temparray.filter(onlyUnique).join();
            $.ajax({url:"https://esi.tech.ccp.is/latest/characters/names/?datasource=tranquility",data:{character_ids:characters},success:function(data,status,xhr){
                data.forEach(function(element) {
                   characterlist[element.character_id]=element.character_name; 
                });
            },method:"GET",contentType: 'application/json',async:false});
        }
    }

    function characterLookup(characterIds) {
        idLookup(characterIds);
        return characterlist;
    }


    function refresh() {
        mailtable=$('#mailHeadersTable').DataTable();
        mailtable.clear();
        selectUser();
    }

    function loadMore() {
        loadPage(lowestMailId);
    }

    function loadPage(last_mail_id) {
        mailtable=$('#mailHeadersTable').DataTable();

        lastid="";

        if (last_mail_id !== 0) {
            lastid="&last_mail_id="+last_mail_id;
        }

        $.getJSON("https://esi.tech.ccp.is/latest/characters/"+characterId+"/mail/?datasource=tranquility"+lastid,function(data,status,xhr) {
            idlist=[];
            individualLookup=[];
            data.forEach(function(element) {
                if (characterlist[element.from] === undefined) {
                    if (element.from<100000000 || element.from>2099999999) {
                        idlist.push(element.from);
                    } else {
                        individualLookup.push(element.from);
                    }
                }
            });
            if (idlist.length>0) {
                idLookup(idlist);
            }
            if (individualLookup.length>0) {
                singleLookup(individualLookup);
            }
            data.forEach(function(element) {
                from='';
                if (characterlist[element.from] !== undefined) {
                    from=characterlist[element.from];
                } else {
                    from="Bad ID - "+ element.from;
                }
                labeltext='';
                element.labels.forEach(function(label) {
                    labeltext+=labels[label]+" ";
                });
                if (element.recipients[0].recipient_type=='mailing_list') {
                    labeltext="Mailing list - "+mailingLists[element.recipients[0].recipient_id]+" "+labeltext;
                }
                row=mailtable.row.add([from,element.subject,element.timestamp,labeltext]).node();
                row.dataset.mailid=element.mail_id;
                if (element.mail_id<lowestMailId) {
                    lowestMailId=element.mail_id;
                }
                if (element.is_read === undefined){
                    $(row).addClass('unread');
                }
            });
        });


    }


    function selectUser() {
        mailtable=$('#mailHeadersTable').DataTable();

        $.getJSON("https://esi.tech.ccp.is/latest/characters/"+characterId+"/mail/labels/?datasource=tranquility",function(data,status,xhr) {
            data.labels.forEach(function(element){
                labels[element.label_id]=element.name;
            });
        });
        
        $.getJSON("https://esi.tech.ccp.is/latest/characters/"+characterId+"/mail/lists/?datasource=tranquility",function(data,status,xhr) {
            data.forEach(function(element){
                mailingLists[element.mailing_list_id]=element.name;
                characterlist[element.mailing_list_id]=element.name;
            });
        });

        loadPage(0);
        $("#mailHeaders").show();
        mailtable.draw();
        $('#mailHeadersTable tbody').on('click','tr',function (){
            displayMail($(this)[0].dataset.mailid);
        });
        $("#newmailbutton").show();

    }

    function displayMail(mailid){

        $.getJSON("https://esi.tech.ccp.is/v1/characters/"+characterId+"/mail/"+mailid+"/",function(data,status,xhr) {
            idlist=[];
            individualLookup=[];
            data.recipients.forEach(function(element) {
                if (characterlist[element.recipient_id] === undefined && element.recipient_type=='character') {
                    if (element.from<100000000 || element.from>2099999999) {
                        idlist.push(element.from);
                    } else {
                        individualLookup.push(element.from);
                    }
                }
            });
            if (idlist.length>0) {
                idLookup(idlist);
            }
            if (individualLookup.length>0) {
                singleLookup(individualLookup);
            }
            recipients=[];
            data.recipients.forEach(function(element) {
                if (element.recipient_type=='character'){
                    recipients.push(characterlist[element.recipient_id]);
                }
                if (element.recipient_type=='corporation'){
                    recipients.push('Corporation');
                }
                if (element.recipient_type=='mailing_list'){
                    recipients.push('Mailing List- '+mailingLists[element.recipient_id]);
                }
            });
            currentmail=data;

            mailBody=$("#mailBody");
            mailBody.empty();
            mailBody.append("<p class='subject'>Subject: "+sanitizer.sanitize(data.subject)+"</p>");
            mailBody.append("<p class='from'>From: "+characterlist[data.from]+"</p>");
            mailBody.append("<p class='timestamp'>Date/Time: "+data.timestamp+"</p>");
            mailBody.append("<p class='to'>to: "+recipients.join()+"</p>");
            mailBody.append("<div id='mailbodytext'>"+sanitizer.sanitize(data.body)+"</div>");

            //$('#mailbodytext').find('*:not(br)').contents().unwrap();



        });
        $("#mailBody font[color]").css('color',function() {if ($(this).attr('color') !== undefined) {return "#"+$(this).attr('color').substr(3,6);}});
        $("#mailBody").show();
        $("#replybutton").show();
    }

    function reply() {  
        $("#mailentry").show();
        mailrecipients=[];
        mailrecipients[0]={};
        mailrecipients[0].recipient_id=currentmail.from;
        mailrecipients[0].recipient_type='character';
        $("#mailentrysubject").val("RE: "+currentmail.subject);
        $("#recipients").text(characterlist[currentmail.from]);
        tinymce.activeEditor.setContent('');
    }

    function sendMail() {

        if (mailrecipients.length===0){
            alert("pick someone to send to");
            return;
        }

        data={};
        data.approved_cost=0;
        mailtext=tinymce.activeEditor.getContent();
        mailtext=mailtext.replace(/<br \/>/g,'<br>');
        mailtext=mailtext.replace(/<font color="#/g,'<font color="#ff');
        data.body=mailtext;
        data.recipients=mailrecipients;
        data.subject=$('#mailentrysubject').val();



        $.ajax({url:"https://esi.tech.ccp.is/v1/characters/"+characterId+"/mail/?datasource=tranquility",data:JSON.stringify(data),success:function(data,status,xhr){
            alert("Mail sent Successfully");
        $("#mailentry").hide();
        $("#mailentrytext").val('');
        $("#mailentrysubject").val('');
        },error:function(jqXHR,status,error){ alert("Error thrown. - "+status);},      
        method:"POST",processData:false,contentType: 'application/json',async:false});


    }

    function cancelSendMail() {
        $("#mailentrytext").val('');
        $("#mailentrysubject").val('');
        $("#mailentry").hide();
        $("#recipientSelection").hide();
    }


    function newMail() {
        $("#mailentry").show();
        mailrecipients=[];
        $("#mailentrytext").val('');
        $("#mailentrysubject").val('');
        $("#recipients").text('');
        $('#addRecipient').show();
        tinymce.activeEditor.setContent('');
    }

    function addRecipient() {
        $("#recipientSelection").show();
    }

    function findRecipient() {
        charstring=encodeURIComponent($("#nameFragment").val());
        $.getJSON("https://esi.tech.ccp.is/latest/search/?categories=character&search="+charstring,function(data,status,xhr) {
            singleLookup(data.character);
            data.character.forEach(function(element) {
                $('#selectRecipient').append("<option value='"+element+"'>"+characterlist[element]+"</option>");
            });
            $("#selectRecipient").show();
            $("#addRecipientButton").show();

        });
    }

    function addRecipientToList() {
        recipientid=$('#selectRecipient').val();
        mailrecipients.forEach(function(element) {
            if (recipientid == element.recipient_id) {
                return;
            }
        });

        mailrecipients.push({recipient_id:recipientid,recipient_type:'character'});
        updateRecipientDisplay();
        $("#recipientSelection").hide();
        $('#selectRecipient').empty();
        $('#selectRecipient').hide();
        $("#addRecipientButton").hide();
    }

    function updateRecipientDisplay() {
        $("#recipients").text('');
        $("#recipients").append("<ul></ul>");
        mailrecipients.forEach(function(element) {
            $("#recipients ul").append("<li>"+characterlist[element.recipient_id]+"</li>");
        });
    }
