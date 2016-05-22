var UPDATE_INTERVAL = 2000;
var TRANSITION_TIMEOUT = 120 * 1000;
var transitCount = 0;

(function($) {
    $(document).ready(function(){

	//---------------------------------------------------
	// main contents creation & update
	//---------------------------------------------------
	var $template = $('#server-entry-template .server-entry');

	$.get('cgi-bin/wakeserver-get.cgi', '', function(text){
	    var json = JSON.parse(text);
	    for (var i in json) {
		var $node = $template.clone(true);
		$node.attr('id', json[i].name);

		var $description = $node.find('.description')
		$('<h1/>').appendTo($description).append(json[i].name);
		$('<p/>').appendTo($description).append(json[i].comment);
		$('<p/>').appendTo($description)
		    .append('IP: ' + json[i].ipaddr);
		$('<p/>').appendTo($description)
		    .append('MAC: ' + json[i].macaddr);

		$node.find('.icon span').css({
		    'background-image': "url('" + json[i].icon + "')"
		});

		applyServerState($node, json[i]);

		$('.server-list').append($node);
	    }
	});

	setTimeout("updateServerState()", UPDATE_INTERVAL);

	//---------------------------------------------------
	// respond to click each server
	//---------------------------------------------------
	$(document).on('click', '.server-entry', function(){
	    var $indicator = $(this).find('.on-indicator');
	    var offState = $indicator.hasClass('off-state');
	    var transitToOn = $indicator.hasClass('transit-to-on');
	    if (offState && !transitToOn){
		var message = 
		    "Are you sure to wake up a server '" + this.id + "' ?";
		var param = {
		    title: "Confirmation",
		    message: message,
		    buttons: YesNoDialog,
		    definitive: false
		};
		var target = this.id;
		popupDialog(param, function(result){
		    if (result != 'Yes') return;
		    
		    var url = 'cgi-bin/wakeserver-wake.cgi';
		    var param = {"target" : target};
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
		});
	    }
	});

	//---------------------------------------------------
	// drower menu operation
	//---------------------------------------------------
	var $close = $();

	$(document).on('click', '.menu-btn', function(){
	    $menu = $(this).parent();
	    $modal = $('.modal');
	    if ($menu.hasClass('menu-open')){
		$menu.removeClass('menu-open');
		$modal.removeClass('modal-inactive');
		$close = $();
	    }else{
		$menu.addClass('menu-open');
		$modal.addClass('modal-inactive');
		$close = $menu;
	    }
	});

	$(document).on('click', '.modal', function(){
	    $modal = $('.modal');
	    $close.removeClass('menu-open');
	    $modal.removeClass('modal-inactive');
	    $close = $();
	});

	return false;
    });
})(jQuery);


//---------------------------------------------------
// functions to update server entry
//---------------------------------------------------
function updateServerState(){
    (function($) {
	$.get('cgi-bin/wakeserver-get.cgi', '', function(text){
	    var servers = JSON.parse(text);
	    var i = 0;
	    $('.server-list .server-entry').each(function(){
		applyServerState($(this), servers[i]);		    
		i++;
	    });
	    
	    setTimeout("updateServerState()", UPDATE_INTERVAL);
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

function popupDialog(params, callback){
    (function($) {
	if (params.definitive){
	    if (callback){
		callback(params.definitive);
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
		$message.append(params.message);
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

		$dialog.find('.button').on('click', function(){
		    $dialog.find('.button').off('click');
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
