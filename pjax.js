/*!
 * pjax v0.9.1
 * @author baijunjie
 */
(function(root, factory) {
	"use strict";

	if (typeof define === "function" && define.amd) {
		define(["jquery"], factory);
	} else if (typeof exports === "object") {
		module.exports = factory(require("jquery"));
	} else {
		root.bjj = root.bjj || {};
		root.bjj.pjax = factory(root.jQuery);
	}

}(this, function($) {
	"use strict";

	var supportPjax = !!window.history.pushState;

	if (supportPjax) {
		// 将所有资源的路径转化成绝对路径
		convertAbsPath($(document.documentElement), location.href);

		var clickEventType = !!navigator.userAgent.match(/mobile/i) ? "touchend" : "click",

			scroller = allowScroll(document.documentElement) ? document.documentElement : document.body,
			$scroller = $(scroller),
			$win = $(window),
			$body = $(document.body),

			cacheData = {},
			pjaxID = 0,

			// 保存当前的 url 以及相关内容信息
			curInfo = {
				href: location.href,
				title: document.title,
				updateList: []
			};

		// 用于保存每个pjax的选择器信息
		cacheData.pjaxOption = [];
		setCache(cacheData, location.href, curInfo);
		history.replaceState(location.href, null, location.href);

		window.addEventListener("popstate", function(e) {
			var href = e.state;
			if (href && href in cacheData) {
				updateContent(cacheData[href]);
			}
			window.setTimeout(savePos, 0); // 这里必须异步执行，否则无效
		}, false);
	}

	var defaultOption = {
		container: "", // 一个选择器，表示替换异步加载内容的容器。如果需要同时替换多个容器中的内容，则每个容器选择器用“,”隔开。
		// container 也可以是一个数组，每个 container 数组值对应一个 link 数组值
		link: "a", // 一个选择器，表示链接。点击后使用 ajax 加载内容。如果需要选择多个链接，则每个链接选择器用“,”隔开。
		// link 也可以是一个数组，每个 link 数组值对应一个 container 数组值
		script: "", // 一个script的选择器，将从加载到的HTML中过滤出选择器指定的script标签
		// script 也可以是一个数组，每个 script 数组值对应一个 container 数组值

		active: "", // 一个选择器，表示可以成为焦点的元素。当页面url更新后，会将href属性值与当前url相同的元素添加上焦点类
		activeClass: "active", // 导航焦点类名
		noCacheClass: "nocache", // 定义一个不缓存类名，声明了该类的链接将不应用缓存，即每次都重新请求

		load: function(url){}, // 加载开始时的回调，this指向加载的导航链接的DOM元素，将请求的url作为参数传入
		done: function(url, data){}, // 加载结束时的回调，this指向加载的导航链接的DOM元素，将请求的url以及请求到的data作为参数传入
		fail: function(url){}, // 加载结束时的回调，this指向加载的导航链接的DOM元素，将请求的url作为参数传入
		replace: function($container){},
		// 替换内容前的回调，this指向新内容链接的DOM元素，将替换的容器的 jQuery 对象作为参数传入，可以得到替换前的内容信息。
		// 如果有多个容器，则每个容器在内容替换前都会调用一次
		complete: function($container){}
		// 替换内容完成后的回调，this指向新内容链接的DOM元素，将替换的容器的 jQuery 对象作为参数传入，可以得到替换后的内容信息。
		// 如果有多个容器，则每个容器在内容替换完成后都会调用一次
	};

	function pjax(option) {
		var opt = $.extend({}, defaultOption, option),

			container = opt.container,
			link = opt.link,
			script = opt.script;

		setActiveNav(opt.active, location.href, opt.activeClass);

		// 如果不支持 pjax，则到此为止
		if (!supportPjax) {
			return;
		}

		container = $.isArray(container) ? container : [container];
		link = $.isArray(link) ? link : [link];

		for (var i = 0, l = Math.min(link.length, container.length); i < l; i++) {
			createPjax(
				container[i],
				link[i],
				$.isArray(script) ? script[i] : script,
				opt
			);
		}
	}

	function createPjax(container, link, script, opt) {
		var active = opt.active,
			activeClass = opt.activeClass,
			noCacheClass = opt.noCacheClass,

			loadCallback = opt.load,
			doneCallback = opt.done,
			failCallback = opt.fail,
			replaceCallback = opt.replace,
			completeCallback = opt.complete,

			id = pjaxID++; // id的主要作用是在更新内容时能拿到内容持有者的 replaceCallback、completeCallback 和 script 脚本

		container = container.split(",");

		cacheData.pjaxOption[id] = {
			container: container,
			script: script,
			active: active,
			activeClass: activeClass,
			replaceCallback: replaceCallback,
			completeCallback: completeCallback
		};

		// 记录容器和内容
		outerloop:
		for (var i = 0, il = container.length; i < il; i++) {
			var selector = container[i];

			for (var j = 0, jl = curInfo.updateList.length; j < jl; j++) {
				if (selector === curInfo.updateList[j].containerSelector) {
					continue outerloop;
				}
			}

			var $container = $(selector);
			curInfo.updateList.push({
				id: id,
				layer: $container.parents().length,
				$content: $container.children(),
				containerSelector: selector
			});
		}

		updateListSort(curInfo.updateList);

		if (link) {
			$(document).on(clickEventType, link, function(e) {
				var href = this.href;

				if (isVoid(this.getAttribute("href"))) {
					return;
				} else {
					e.preventDefault();
				}

				var $this = $(this);

				if (!$this.hasClass(noCacheClass) && href in cacheData) {

					var info = cacheData[href];
					info.link = this;

					if (info === curInfo) {
						return;
					}

					updateContent(info, container);
					changeHistory(href);

				} else {
					loadCallback.call(this, href);

					$.ajax({
						url: href,
						type: "GET",
						context: this,
						beforeSend: function(xhr) {
							xhr.setRequestHeader("X-PJAX", true);
							xhr.setRequestHeader("X-PJAX-Container", container);
						}

					}).done(function(data) {

						parseHTML(data, href);

						var info = cacheData[href];
						info.link = this;

						updateContent(info, container);
						changeHistory(href);

						doneCallback.call(this, href, data);

					}).fail(function() {
						failCallback.call(this, href);
					});
				}
			});
		}
	}

	function updateContent(info, container) {
		var l = info.updateList.length,
			$updateContainer = $();

		while (l--) {
			// 从最外层开始更新容器内容
			var updateInfo = info.updateList[l],
				selector = updateInfo.containerSelector;

			if ($.isArray(container) && $.inArray(selector, container) < 0) {
				continue;
			}

			var $container = $(selector),
				$content = updateInfo.$content;

			if (!$content.length
			|| !$container.length
			|| $content.html() === $container.children().html()) {
				continue;
			}

			var id = updateInfo.id,
				opt = cacheData.pjaxOption[id];

			opt.replaceCallback.call(info.link, $container);

			$container.children().detach();
			$container
				.stop()
				.hide()
				.append($content)
				.fadeIn();

			opt.completeCallback.call(info.link, $container);

			$updateContainer = $updateContainer.add($container);
		}

		adjustPos($updateContainer);

		if (info.title) {
			document.title = info.title;
		}

		l = cacheData.pjaxOption.length;
		while (l--) {
			var opt = cacheData.pjaxOption[l];
			if (container && container !== opt.container) continue;
			setActiveNav(opt.active, info.href, opt.activeClass);

			var $script = info.script && info.script[l]
			if ($script) {
				$body.append($script);
				info.script[id] = undefined; // 保证脚本只被添加一次
			}
		}

		curInfo = info;
	}

	function parseHTML(data, href) {
		var str = $.trim(data),
			doms = $.parseHTML(str, null, true),
			$doms = $(doms),
			$wrap = $("<div>").append($doms),

			pjaxOption = cacheData.pjaxOption,
			info = {},
			id = [], // 表示内容持有者的ID
			layer = [], // 表示容器的层级数
			content = [],
			script = [],
			containerSelector = [];

		$doms = $doms.filter(":not(script)");

		// 根据ajaxOption获取相应的内容信息
		for (var i = 0, il = pjaxOption.length; i < il; i++) {
			var opt = pjaxOption[i];
			if (opt.script) {
				script.push($wrap.find(opt.script));
			}

			for (var j = 0, jl = opt.container.length; j < jl; j++) {
				var selector = opt.container[j];

				id.push(i);
				layer.push($(selector).parents().length);
				containerSelector.push(selector);

				var $dom = $wrap.find(selector + " >");
				if ($dom.length) {
					convertAbsPath($dom, href);
				} else {
					$dom = $(selector + " >")
				}

				content.push($dom);
			}
		}

		// 为信息对象创建一个更新队列
		var updateList = [],
			l = layer.length;

		while (l--) {
			updateList.push({
				id: id[l],
				layer: layer[l],
				$content: content[l],
				containerSelector: containerSelector[l]
			});
		}

		updateListSort(updateList);

		info.updateList = updateList;
		info.href = href;
		info.title = $doms.filter("title").text();
		info.script = script;

		setCache(cacheData, href, info);
	}

	// 因为遍历是倒序遍历，因此按层级从大到小排列
	function updateListSort(updateList) {
		updateList.sort(function(a, b) {
			return -(a.layer - b.layer);
		});
	}

	function changeHistory(href) {
		savePos();
		history.pushState(href, null, href);
	}

	// 根据 href 设置焦点导航
	function setActiveNav(link, href, activeClass) {
		var $link = $(link),
			$curLink = getCurLink($link, href);

		if ($curLink) {
			$link.removeClass(activeClass);
			$curLink.addClass(activeClass);
		}
	}

	// 根据url获取对应链接的 jQuery 对象
	function getCurLink($link, href) {
		var url = getUrl(href),
			$curLink = null;
		$link.each(function(i, n) {
			if (!isVoid(n.getAttribute("href")) && getUrl(n.href) === url) {
				if (!$curLink) $curLink = $(n);
				else $curLink = $curLink.add(n);
			}
		});
		return $curLink;
	}

	function setCache(cache, href, value) {
		var url = getUrl(href);
		for (var key in cache) {
			if (getUrl(key) === url) {
				delete cache[key];
				break;
			}
		}
		cache[href] = value;
	}

	// 判断 href 是否为无效值
	function isVoid(href) {
		return !href || href.indexOf("#") === 0 || href.indexOf("javascript:") === 0;
	}

	// 判断是否为绝对路径
	function isAbsPath(href) {
		return href && (href.indexOf("http") === 0 || href.indexOf("file:") === 0);
	}

	// 获取当前的域名
	function getHostname() {
		return location.protocol + "//" + location.host;
	}

	// 获取不包含 # ? 部分的 url
	function getUrl(href) {
		return href ? href.replace(/[#?].*$/, "") : location.protocol + "//" + location.host + location.pathname;
	}

	// 获取路径
	// http://www.baidu.com/page/index.html  =>  http://www.baidu.com/page/
	function getDir(href) {
		return href.replace(/[^\/]*$/, "");
	}

	// 获取相对路径
	// href = "http://www.baidu.com/page/content/index.html";
	// dir  = "http://www.baidu.com/page/";
	//      =>  "content/index.html"
	function getRelPath(href, dir) {
		return href.replace(dir, "");
	}

	// 获取绝对路径
	// dir    = "http://www.baidu.com/page/content/";
	//
	// relPath = "../map/baidumap.html";
	//        =>  "http://www.baidu.com/page/map/baidumap.html";
	//
	// relPath = "./map/baidumap.html";
	//        =>  "http://www.baidu.com/page/content/map/baidumap.html";
	//
	// relPath = "/map/baidumap.html";
	//        =>  "http://www.baidu.com/map/baidumap.html";
	function getAbsPath(dir, relPath) {
		if (!relPath.indexOf("../")) {
			var i = 0;
			relPath = relPath.replace("../", function() {
				i = 1;
				dir = dir.replace(/[^\/]*\/?$/, "");
				return "";
			});

			if (i) return getAbsPath(dir, relPath);
		} else if (!relPath.indexOf("./")) {
			relPath = relPath.replace("./", "");
		} else if (!relPath.indexOf("/")) {
			dir = getHostname();
		}

		return dir + relPath;
	}

	// 将所有资源的路径转化成绝对路径
	function convertAbsPath($dom, href) {
		var $doms = $dom.filter("[href],[src]").add($dom.find("[href],[src]")),
			curDir = getDir(href);

		$doms.each(function(i, n) {
			var href = n.getAttribute("href"),
				src = n.getAttribute("src");

			if (!isVoid(href) && !isAbsPath(href)) {
				n.href = getAbsPath(curDir, href);
			}
			if (!isVoid(src) && !isAbsPath(src)) {
				n.src = getAbsPath(curDir, src);
			}
		});
	}

	// 这个方法用于在页面添加历史记录点前，强制浏览器记录当前的scroll位置
	// 如果不使用该方法，那么在Chrome浏览器下会有以下两个问题
	// - 两次浏览器历史改变期间，页面没有滚动，当后退到该记录点时，页面会回到文档顶部
	// - 回退到前一条历史时，如果不滚动页面，当加载新链接时，页面还是会回到文档顶部
	function savePos() {
		allowScroll(scroller, true);
	}

	function allowScroll(elem, testHor) {
		var st = elem.scrollTop;
		elem.scrollTop += (st > 0) ? -1 : 1;
		if (elem.scrollTop != st) {
			elem.scrollTop = st;
			return true;
		}

		if (!testHor) return;

		var sl = elem.scrollLeft;
		elem.scrollLeft += (sl > 0) ? -1 : 1;
		if (elem.scrollLeft != sl) {
			elem.scrollLeft = sl;
			return true;
		}
	}

	function adjustPos($elem) {
		if (!$elem.length) return;

		var winHalfWidth = $win.width() / 2,
			winHalfHeight = $win.height() / 2,
			x = $win.scrollLeft(),
			y = $win.scrollTop(),
			left,
			top;

		$elem.each(function(i, n) {
			var rect = this.getBoundingClientRect();
			if (left === undefined || left > rect.left) left = rect.left;
			if (top === undefined || top > rect.top) top = rect.top;
		});

		if (left > winHalfWidth || left < 0) x += left;
		if (top > winHalfHeight || top < 0) y += top;

		$scroller.stop().animate({
			scrollLeft: x,
			scrollTop: y
		});
	}

	return pjax;

}));