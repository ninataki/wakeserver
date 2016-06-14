var UPDATE_INTERVAL = 3000;
var UPDATE_INTERVAL_ERROR = 5000;
var TRANSITION_TIMEOUT = 120 * 1000;
var transitCount = 0;

var defaults = {
    "confirm-wake-up": 'true',
    "confirm-shut-down": 'true'
};

var clickEvent="click";

var serverList = [];

(function($) {
    $(document).ready(function(){

	initSVGLibrary();
	
	//---------------------------------------------------
	// main contents creation & update
	//---------------------------------------------------
	var $template = $('#server-entry-template .server-entry');

	$.get('cgi-bin/wakeserver-get.cgi', {"type": "full"}, function(text){
	    var definitions = ServerDefinitionList(text);
	    $.get('cgi-bin/wakeserver-get.cgi', '', function(text){
		var statuses = JSON.parse(text);
		var $placeholder = $('.server-list');
		var currentGroup;
		definitions.foreach(function (entry) {
		    if (entry.groupName){
			var group = entry
			currentGroup = group;
			var $node = 
			    $('<div>' + entry.groupName + '</div>').attr(
				"class", "server-group",
				"groupid", entry.groupid
			    ).on(clickEvent, function(){
				var selector = 
				    '.server-entry[groupid = ' +
				    group.groupid + ']';
				var target = $(selector);
				$(selector).toggleClass('fold');
				$(this).toggleClass('fold');
			    });
			if (group.icon){
			    $node.addClass('withicon');
			    $("<div/>").prependTo($node).attr({
				"class": "icon"
			    }).append(svgInLib(group.icon));
			}
			if (group.initial != 'open'){
			    $node.addClass('fold');
			}
			if (group.groupTitle != 'hide'){
			    $placeholder.append($node);
			}
		    }else{
			var server = entry;
			serverList.push(server);
			var $node = $template.clone(true);
			$node.attr({
			    'id': server.name,
			    'server-index': serverList.length - 1,
			    'groupid': server.groupid
			});
			if (currentGroup && currentGroup.initial != 'open'){
			    $node.addClass('fold');
			}
			var wakable = server.scheme.on;
			var sleepable = server.scheme.off;
			if (wakable){
			    $node.addClass('wakable');
			}
			if (sleepable){
			    $node.addClass('sleepable');
			}

			var $description = $node.find('.description')
			$('<h1/>').appendTo($description).append(server.name);
			$('<p/>').appendTo($description).
			    append(server.comment);
			$('<p/>').appendTo($description)
			    .append('IP: ' + server.ipaddr);
			$('<p/>').appendTo($description)
			    .append('MAC: ' + server.macaddr);

			$node.find('.icon span').css({
			    'background-image': "url('" + server.icon + "')"
			});

			applyServerState($node, 
					 statuses[serverList.length -1]);

			$placeholder.append($node);
		    }
		});
	    });
	});

	setTimeout("updateServerState()", UPDATE_INTERVAL);

	//---------------------------------------------------
	// set up inital state of controls in drawer menu
	//---------------------------------------------------
	reflectToToggleMenu('confirm-wake-up');
	reflectToToggleMenu('confirm-shut-down');
	
	//---------------------------------------------------
	// respond to click each server
	//---------------------------------------------------
	$('.server-entry').on(clickEvent, function(){
	    var $indicator = $(this).find('.on-indicator');
	    var offState = $indicator.hasClass('off-state');
	    var transitToOn = $indicator.hasClass('transit-to-on');
	    var wakable = $(this).hasClass('wakable');
	    var sleepable = $(this).hasClass('sleepable');
	    
	    showDashboard(
		serverList[$(this).attr('server-index')],
		$indicator,
		!offState, transitToOn);
	});

	//---------------------------------------------------
	// drower menu operation
	//---------------------------------------------------
	var $close = $();

	$('.drawer-menu .menu-btn').on(clickEvent, function(){
	    $menu = $(this).parent();
	    $modal = $('.modal');
	    if ($menu.hasClass('menu-open')){
		$menu.removeClass('menu-open');
		$modal.removeClass('modal-inactive');
		$close = $();
	    }else{
		$menu.addClass('menu-open');
		$modal.addClass('modal-inactive');
		resetAboutSheet();
		$close = $menu;
	    }
	});

	$('.modal').on(clickEvent, function(){
	    var $modal = $('.modal');
	    $close.removeClass('menu-open');
	    $modal.removeClass('modal-inactive');
	    $close = $();
	});

	$('.drawer-menu .menu-item').on(clickEvent, function(){
	    if (this.id == 'confirm-wake-up' || 
		this.id == 'confirm-shut-down'){
		toggleMenu($(this));
	    }else if (this.id == 'about-service'){
		showAboutSheet();
	    }else{
		var param = {
		    title: "Not implemented",
		    message: "Please wait releasing a new revision " + 
			     "which implement this feature.",
		    buttons: OkDialog,
		    definitive: false,
		    definitiveValue: false
		};
		popupDialog(param);
	    }
	});

	//---------------------------------------------------
	// SVG load
	//---------------------------------------------------
	$('.svg-placeholder').each(function(){
	    var $placeholder = $(this);
	    var svg = $placeholder.attr("svg-path");
	    $placeholder.load(svg + " svg", function(){
		var $this = $(this);
		if ($this.hasClass("svg-animate")){
		    initSvgAnimation(this);
		}; 
	    });
	});

	//---------------------------------------------------
	// reset about sheet
	//---------------------------------------------------
	resetAboutSheet();
	
	return false;
    });
})(jQuery);


//---------------------------------------------------
// server definition list object include iterator
//---------------------------------------------------
function ServerDefinitionList(text){
    var object = {
	definitions: JSON.parse(text),
	foreach: function(callback){
	    for (var i in this.definitions){
		var group = this.definitions[i];
		group.groupid = i;
		callback(group);
		for (var j in group.servers){
		    server = group.servers[j];
		    server.groupid = i;
		    callback(server);
		}
	    }
	}
    };
    return object;
}


//---------------------------------------------------
// functions to update server entry
//---------------------------------------------------
function updateServerState(){
    (function($) {
	$.ajax({
	    type: "GET",
	    url: 'cgi-bin/wakeserver-get.cgi',
	    scriptCharset: 'utf-8',
	    dataType:'json',
	    success: function(servers) {
		var i = 0;
		$('.server-list .server-entry').each(function() {
		    applyServerState($(this), servers[i]);
		    i++;
		});
		$('header .logo').removeClass('error-logo');
		setTimeout("updateServerState()", UPDATE_INTERVAL);
	    },
	    error: function(xhr, textStatus, errorThrown) {
		$('header .logo').addClass('error-logo');
		setTimeout("updateServerState()", UPDATE_INTERVAL_ERROR);
	    }
	});
    })(jQuery);
}

function applyServerState($node, server){
    (function($) {
	var $indicator = $node.find('.on-indicator');
	var inOffState = $indicator.hasClass('off-state');
	if (inOffState && server.status == 'on'){
	    $indicator.removeClass('off-state');
	    $indicator.removeClass('transit-to-on');
	}else if (!inOffState && server.status == 'off'){
	    $indicator.addClass('off-state');
	    $indicator.removeClass('transit-to-on');
	}
    })(jQuery);
}

//---------------------------------------------------
// confirmation dialog
//---------------------------------------------------

var YesNoDialog = [{
    name: "Yes",
    isDefault: false,
},{
    name: "No",
    isDefault: true,
}];

var OkDialog = [{
    name: 'OK',
    isDefault: true
}];

function popupDialog(params, callback){
    (function($) {
	if (params.definitive){
	    if (callback){
		callback(params.definitiveValue);
	    }
	}else{
	    $dialog = $('#popup-dialog')
	    if ($dialog.hasClass('modal-active')){
		if (callback){
		    callback(null);
		}
	    }else{
		$frame = $dialog.find('.dialog-frame');
		$title = $frame.find('.title').empty();
		$message = $frame.find('.message').empty();
		$placeholder = $frame.find('.button-placeholder').empty();

		$title.append(params.title);
		$message.append(params.message.replace(/\n/g, "<br>"));
		var i;
		for (i in params.buttons){
		    var button = params.buttons[i];
		    var $button = $('<div/>').append(button.name);
		    $button.addClass('button');
		    $button.attr('button-id', button.name);
		    if (button.isDefault){
			$button.addClass('default-button');
		    }
		    $placeholder.append($button);
		}
		$placeholder.find('.button')
		    .css('width', '' + 100 / params.buttons.length + '%');

		$dialog.find('.button').on(clickEvent, function(){
		    $dialog.find('.button').off(clickEvent);
		    $dialog.removeClass('modal-active');
		    if (callback){
			callback($(this).attr('button-id'));
		    }
		});

		$dialog.addClass('modal-active');
	    }
	}
    })(jQuery);
}

//---------------------------------------------------
// toggle switch
//---------------------------------------------------
function configValue(nodeid){
    var value = localStorage.getItem(nodeid);
    if (!value){
	value = defaults[nodeid];
    }

    return value;
}

function reflectToToggleMenu(nodeid){
    (function($) {
	var value = configValue(nodeid);
	var $node = $('#' + nodeid);
	$node.removeClass('toggle-on');
	if (value == 'true'){
	    $node.addClass('toggle-on');
	}
    })(jQuery);
}

function toggleMenu($node){
    (function($) {
	var key = $node.attr("id");
	var value;
	if ($node.hasClass('toggle-on')){
	    $node.removeClass('toggle-on');
	    value = 'false';
	}else{
	    $node.addClass('toggle-on');
	    value = 'true';
	}
	localStorage.setItem(key, value);
    })(jQuery);
}

//---------------------------------------------------
// SVG animation
//---------------------------------------------------
function initSvgAnimation(node){
    paths = new Array();
    var totalLength = 0;
    [].slice.call(node.querySelectorAll('path')).forEach(function(path, i){
	paths[i] = {node: path, length: path.getTotalLength()};
	totalLength += paths[i].length;
    });

    var currentLength = 0;
    for (i = 0; i < paths.length; i++){
	paths[i].node.style.strokeDasharray = 
	    (totalLength - currentLength) + ' ' + 
	    (totalLength + currentLength);
	paths[i].node.style.strokeDashoffset = totalLength;

	currentLength += paths[i].length;
    }
}

//---------------------------------------------------
// about sheet
//---------------------------------------------------
function resetAboutSheet(){
    (function($) {
	$('.about-sheet').removeClass('about-sheet-show');
    })(jQuery);
}

function showAboutSheet(){
    (function($) {
	$('.about-sheet .hidable').addClass('hide');
	$('.about-sheet .svg-animate').removeClass('svg-draw');
	$('.about-sheet').addClass('about-sheet-show');
	transitAboutSheet();
    })(jQuery);
}

var aboutSheetTransitionCount = 0;

function transitAboutSheet(hash, phase){
    (function($) {
        if (hash && hash != aboutSheetTransitionCount){
	    return;
        }
	if (!$('.about-sheet').hasClass('about-sheet-show')){
	    return;
	}
	
	if (!phase){
	    phase = 0;
	}

	phase++;
	
	if (phase == 1){
            aboutSheetTransitionCount++;
            hash = aboutSheetTransitionCount;
	    setTimeout(function(){transitAboutSheet(hash, phase);}, 800);
	}else if (phase == 2){
	    $('.about-sheet .title').removeClass('hide');
	    setTimeout(function(){transitAboutSheet(hash, phase);}, 700);
	}else if (phase == 3){
	    $('.raspi-line').addClass('svg-draw');
	    setTimeout(function(){transitAboutSheet(hash, phase);}, 6300);
	}else if (phase == 4){
	    $('.raspi-image').removeClass('hide');
	    setTimeout(function(){transitAboutSheet(hash, phase);}, 1200);
	}else if (phase == 5){
	    $('.raspi-title').removeClass('hide');
	    $('.about-sheet .remark').removeClass('hide');
	}	
    })(jQuery);
}

//---------------------------------------------------
// dashboard
//---------------------------------------------------
var dashboardMenuConf = {
    "webui": {
	"text": "Web Interface",
	"icon": "webui",
	"prefix": "http"
    },
    "ssh": {
	"text": "SSH Console",
	"icon": "ssh",
	"prefix": "ssh"
    },
    "vnc": {
	"text": "Remote Screen",
	"icon": "vnc",
	"prefix": "vnc"
    },
    "config-app": {
	"text": "Configuration App",
	"icon": "config",
	"prefix": "http"
    },
    "smb": {
	"text": "CIFS sharing",
	"icon": "folder",
	"prefix": "smb"
    },
    "afp": {
	"text": "AFP sharing",
	"icon": "folder",
	"prefix": "afp"
    }
};

function showDashboard(server, $indicator, isRunning, isInTransition){
    (function($) {
	var scheme = server["scheme"];
	var services = scheme["services"];
	var $menues = $('#dashboard #dashboard-menu').empty();

	if (!isRunning && !isInTransition && scheme.on){
	    var $icon = $('<div></div>').attr({
		"class": "icon"
	    }).append(svgInLib('power'));
	    $('<div>Wake up a server</div>').appendTo($menues).attr({
		"class": "dmenu-item"
	    }).on(clickEvent, function(){
		wakeupServer(server.name, $indicator, function(){
		});
		closeDashboard();
	    }).prepend($icon);
	}else if (isRunning && !isInTransition && scheme.off){
	    var $icon = $('<div></div>').attr({
		"class": "icon"
	    }).append(svgInLib('power'));
	    $('<div>Stop a server</div>').appendTo($menues).attr({
		"class": "dmenu-item"
	    }).on(clickEvent, function(){
		sleepServer(server.name, $indicator, function(){
		});
		closeDashboard();
	    }).prepend($icon);
	}

	for (var i in services){
	    (function(){
		var service = services[i];
		var config = dashboardMenuConf[service.type];
		if (isRunning || service.enable == "always"){
		    var scheme = service.prefix ? 
			service.prefix : config.prefix;
		    var suffix = service.suffix ?
			service.suffix : "";
		    var url = 
			scheme + "://" + server.ipaddr + "/" + suffix;
		    var $icon = $('<div></div>').attr({
			"class": "icon"
		    }).append(svgInLib(config.icon));
		    $('<a>' + config.text + '</a>').appendTo($menues).
			attr({
			    "class": "dmenu-item",
			    "href": url,
			    "target": "_blank"
			}).on(clickEvent, function(){
			    closeDashboard();
			}).prepend($icon);
		}
	    })();
	}
	
	var items = $menues.find('.dmenu-item');
	if (items.length > 0){
	    $('#dashboard .server').empty().append(server.name);
	    $('#dashboard .comment').empty().append(server.comment);
	    $('#dashboard .dashboard-icon').css({
		'background-image': "url('" + server.icon + "')"
	    });
	    var $dashboard = $('#dashboard');
	    $dashboard.find('#dashboard-cancel').on(clickEvent, function(){
		closeDashboard();
	    });
	    /*
	    var $from = $('.server-list #' + 
		      escapeSelectorString(server.name) + 
		      ' .icon');
	    $('#dashboard-main').offset({
		top: $from.offset().top + $from.height(),
		left: $from.offset().left + $from.width()
	    });
	    */
	    $dashboard.addClass('modal-active');
	}
	
    })(jQuery);
}

function closeDashboard(){
    (function($) {
	$('#dashboard').removeClass('modal-active')
    })(jQuery);
}

//---------------------------------------------------
// wake up & sleep requestor
//---------------------------------------------------
function wakeupServer(server, $indicator, callback){
    (function($) {
	var message = "Are you sure to wake up a server '" + server + "' ?";
	var param = {
	    title: "Wake up a Server",
	    message: message,
	    buttons: YesNoDialog,
	    definitive: configValue('confirm-wake-up') != 'true',
	    definitiveValue: "Yes"
	};
	popupDialog(param, function(result){
	    if (result != 'Yes'){
		callback();
		return;
	    }
	    
	    var url = 'cgi-bin/wakeserver-wake.cgi';
	    var param = {"target" : server};
	    $.post(url, param, function(data) {
		var foo = data;
	    });
	    var counter = transitCount++;
	    $indicator.attr('transit-counter', counter);
	    $indicator.addClass('transit-to-on');
	    setTimeout(function(){
		if ($indicator.attr('transit-counter') == counter){
		    $indicator.removeClass('transit-to-on');
		}
	    }, TRANSITION_TIMEOUT);
	    callback();
	});
    })(jQuery);
}

function sleepServer(serverName, $indicator, callback){
    (function($) {
	var message = "Are you sure to stop a server '" + serverName + "' ?";
	var param = {
	    title: "Stop a Server",
	    message: message,
	    buttons: YesNoDialog,
	    definitive: configValue('confirm-shut-down') != 'true',
	    definitiveValue: "Yes"
	};
	popupDialog(param, function(result){
	    if (result != 'Yes'){
		callback();
		return;
	    }
	    
	    $.ajax({
		type: "POST",
		url: 'cgi-bin/wakeserver-sleep.cgi',
		data: {"target" : serverName},
		scriptCharset: 'utf-8',
		dataType:'json',
		success: function(result) {
		    if (!result.result){
			var param = {
			    title: "Fail to stop a server",
			    message: result.message,
			    buttons: OkDialog,
			    definitive: false,
			    definitiveValue: false
			};
			popupDialog(param);
			$indicator.removeClass('transit-to-on');
		    }
		}
	    });
	    
	    var counter = transitCount++;
	    $indicator.attr('transit-counter', counter);
	    $indicator.addClass('transit-to-on');
	    setTimeout(function(){
		if ($indicator.attr('transit-counter') == counter){
		    $indicator.removeClass('transit-to-on');
		}
	    }, TRANSITION_TIMEOUT);

	    callback();
	});
    })(jQuery);
}


//---------------------------------------------------
// SVG libraly
//---------------------------------------------------
var $svgLibrary

function initSVGLibrary(){
    (function($) {
	$.ajax({
            url: 'images/svglib.xml',
            type: 'get',
            dataType: 'xml',
            timeout: 1000,
            success: function(xml){
		$svgLibrary = $(xml);
	    },
	    error: function(){
		var foo;
	    }
	});  
    })(jQuery);
}

function svgInLib(name){
    var $svg;
    (function($) {
	var selector = 'svg#'+escapeSelectorString(name);
	$svg = $svgLibrary.find(selector).clone();
    })(jQuery);
    return $svg;
}

//---------------------------------------------------
// Utilities
//---------------------------------------------------
function escapeSelectorString(val){
    return val.replace(/[ !"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, "\\$&");
}
