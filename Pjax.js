/*!
 * Pjax v1.2.5
 * @author Junjie.Bai
 *
 * https://github.com/baijunjie/pjax.js
 */
(function(root, factory) {
    'use strict';

    if (typeof module === 'object' && typeof exports === 'object') {
        module.exports = factory(require('jquery'));
    } else if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else {
        root.Pjax = factory(root.jQuery);
    }

}(this, function($) {
    'use strict';

    var supportPjax = !!window.history.pushState;

    var scroller = allowScroll(document.documentElement) ? document.documentElement : document.body,
        $scroller = $(scroller),
        $win = $(window),
        $doc = $(document),
        $body = $(document.body),

        noConvertPath, // 表示是否b不转换页面中所有资源的相对路径。
        cacheData = {},
        pjaxID = 0,
        curInfo = {}; // 保存当前的 url 以及相关内容信息

    // 因为遍历是倒序遍历，因此按层级从大到小排列
    function updateListSort(updateList) {
        updateList.sort(function(a, b) {
            return -(a.layer - b.layer);
        });
    }

    function changeHistory(href, noHistory, noChangeURL) {
        if (!supportPjax) return;
        savePos();
        if (noHistory) {
            history.replaceState(href, null, noChangeURL ? null : href);
        } else {
            history.pushState(href, null, noChangeURL ? null : href);
        }
    }

    // 根据 href 设置焦点导航
    function setActiveNav(link, activeClass, href) {
        if (!link || !activeClass || !href) return;

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
            if (!isVoid(n.getAttribute('href')) && getUrl(n.href) === url) {
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
        return !href || href.indexOf('#') === 0 || href.indexOf('javascript:') === 0;
    }

    // 判断是否为绝对路径
    function isAbsPath(href) {
        return href && (href.indexOf('http') === 0 || href.indexOf('file:') === 0 || href.indexOf('data:') === 0);
    }

    // 获取当前的域名
    function getCurHostname() {
        return location.protocol + '//' + location.host;
    }

    // 获取不包含 # 部分的 url
    function getUrl(href) {
        return href ? href.replace(/#.*$/, '') : location.protocol + '//' + location.host + location.pathname;
    }

    // 获取路径
    // http://www.baidu.com/page/index.html  =>  http://www.baidu.com/page/
    function getDir(href) {
        return href.replace(/[^\/]*$/, '');
    }

    // 合并路径
    // path     = 'http://www.baidu.com/page/content/';
    //
    // filePath = '../map/baidumap.html';
    //          =>  'http://www.baidu.com/page/map/baidumap.html';
    //
    // filePath = './map/baidumap.html';
    //          =>  'http://www.baidu.com/page/content/map/baidumap.html';
    //
    // filePath = '/map/baidumap.html';
    //          =>  'http://www.baidu.com/map/baidumap.html';
    function combinePath(path, filePath) {
        path = path.replace(/\/+$/, '') + '/';

        if (!filePath.indexOf('../')) {
            var replaced = false;
            filePath = filePath.replace('../', function() {
                replaced = true;
                path = path.replace(/[^\/]*\/?$/, '');
                return '';
            });
            if (replaced) return combinePath(path, filePath);
        } else if (!filePath.indexOf('./')) {
            filePath = filePath.replace('./', '');
        } else if (!filePath.indexOf('/')) {
            path = getCurHostname();
        }

        return path + filePath;
    }

    // 将所有资源的路径转化成绝对路径
    function convertAbsPath($dom, href) {
        if (noConvertPath) return;

        var $doms = $dom.filter('[href],[src]').add($dom.find('[href],[src]')),
            curDir = getDir(href);

        $doms.each(function(i, n) {
            var href = n.getAttribute('href'),
                src = n.getAttribute('src');

            if (!isVoid(href) && !isAbsPath(href)) {
                n.href = combinePath(curDir, href);
            }
            if (!isVoid(src) && !isAbsPath(src)) {
                n.src = combinePath(curDir, src);
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
        if (elem.scrollTop !== st) {
            elem.scrollTop = st;
            return true;
        }

        if (!testHor) return;

        var sl = elem.scrollLeft;
        elem.scrollLeft += (sl > 0) ? -1 : 1;
        if (elem.scrollLeft !== sl) {
            elem.scrollLeft = sl;
            return true;
        }
    }

    function adjustPos($elem, offsetX, offsetY) {
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
            scrollLeft: x - offsetX,
            scrollTop: y - offsetY
        });
    }

    function removeScript(html) {
        if(typeof html !== 'string' || html.indexOf('<script') === -1) return html;
        var reg = /<script[^>]*?>[^\x00]*?<\/script>/ig;
        return html.replace(reg, '');
    }

    function parseHTML(data, href) {
        var headReg = new RegExp('<head[^\>]*?>([^\x00]*?)<\/head>', 'i'),
            bodyReg = new RegExp('<body[^\>]*?>([^\x00]*?)<\/body>', 'i'),
            head = removeScript(headReg.exec(data)),
            body = removeScript(bodyReg.exec(data)),
            $headChildren = head ? $(head[1]) : null,
            $bodyChildren = body ? $(body[1]) : null,
            $head = $headChildren ? $('<div>').append($headChildren) : null,
            $body = $bodyChildren ? $('<div>').append($bodyChildren) : null,

            pjaxOptions = cacheData.pjaxOptions,
            info = {},
            id = [], // 表示内容持有者的ID
            layer = [], // 表示容器的层级数
            script = [],
            container = [],
            containerSelector = [];

        // 根据ajaxOptions获取相应的内容信息
        var alreadyGetSelector = {}; // 记录已经获取过的选择器，防止重复获取
        for (var i = 0, len = pjaxOptions.length; i < len; i++) {
            var opt = pjaxOptions[i];
            if (opt.script) {
                script.push($head.find(opt.script).add($body.find(opt.script)));
            }

            for (var j = 0, selector; selector = opt.container[j++];) {
                if (alreadyGetSelector[selector]) continue;

                id.push(i);
                layer.push($(selector).parents().length);
                containerSelector.push(selector);

                var $dom;
                if (selector === 'head') {
                    $dom = $head;
                } else if (selector === 'body') {
                    $dom = $body;
                } else {
                    $dom = $body.find(selector);
                }

                if ($dom.length) {
                    convertAbsPath($dom, href);
                } else {
                    $dom = $(selector);
                }

                container.push($dom);
                alreadyGetSelector[selector] = true;
            }
        }

        // 为信息对象创建一个更新队列
        var updateList = [],
            l = layer.length;

        while (l--) {
            updateList.push({
                id: id[l],
                layer: layer[l],
                $container: container[l],
                containerSelector: containerSelector[l]
            });
        }

        updateListSort(updateList);

        info.updateList = updateList;
        info.href = href;
        info.title = $head.children('title').text();
        info.script = script;

        setCache(cacheData, href, info);
    }

    function createPjax(container, link, script, noCache, noHistory, noChangeURL, adjust, pile, opt) {
        var active = opt.active,
            activeClass = opt.activeClass,

            updateCallback = opt.update,
            completeCallback = opt.complete,

            noCacheIsArray = $.isArray(noCache),
            noHistoryIsArray = $.isArray(noHistory),
            noChangeURLIsArray = $.isArray(noChangeURL),
            adjustIsArray = $.isArray(adjust),
            pileIsArray = $.isArray(pile),

            id = pjaxID++; // id的主要作用是在更新内容时能拿到内容持有者的 updateCallback、completeCallback 和 script 脚本

        container = $.map(container.split(','), function(n){ return $.trim(n); });
        link = $.map(link.split(','), function(n){ return $.trim(n); });

        cacheData.pjaxOptions[id] = {
            container: container,
            script: script,
            active: active,
            activeClass: activeClass,
            updateCallback: updateCallback,
            completeCallback: completeCallback
        };

        // 记录容器和内容
        outerloop:
            for (var i = 0, selector; selector = container[i++];) {
                for (var j = 0, l = curInfo.updateList.length; j < l; j++) {
                    if (selector === curInfo.updateList[j].containerSelector) {
                        continue outerloop;
                    }
                }

                var $container = $(selector);
                curInfo.updateList.push({
                    id: id,
                    layer: $container.parents().length,
                    $container: $container.clone().html(removeScript($container.html())),
                    containerSelector: selector
                });
            }

        updateListSort(curInfo.updateList);

        curInfo.script[id] = $(script);

        if (link.length) {
            for (i = 0, l = link.length; i < l; i++) {
                if (link[i]) {
                    $doc.on('click', link[i],
                        $.proxy(
                            linkClickCallback,
                            this,
                            noCacheIsArray ? noCache[i] : noCache,
                            noHistoryIsArray ? noHistory[i] : noHistory,
                            noChangeURLIsArray ? noChangeURL[i] : noChangeURL,
                            adjustIsArray ? adjust[i] : adjust,
                            pileIsArray ? pile[i] : pile,
                            opt,
                            container)
                    );
                }
            }
        }
    }

    function linkClickCallback(noCache, noHistory, noChangeURL, adjust, pile, opt, container, e) {
        var link = e.target,
            href = link.href;

        if (isVoid(link.getAttribute('href'))) {
            return;
        } else {
            e.preventDefault();
        }

        if (!noCache && href in cacheData) {

            var info = cacheData[href];
            if (info === curInfo) {
                return;
            }

            updateContent.call(this, info, container, pile, adjust, opt.adjustOffset);
            changeHistory(href, noHistory, noChangeURL);

        } else {
            ajaxUpdate.call(this, opt, link, href, container, noHistory, noChangeURL, adjust, pile);
        }
    }

    // info 更新的数据信息
    // container 需要更新容器的选择器组成的数组。如果 container 为空，则会更新数据信息中所有的内容
    // pile 表示更新是否累积的规则所组成的数组，该数组中的每一个值和 container 数组参数中每一个值对应
    // adjust 表示更新完成后是否调整页面位置
    // adjustOffset 表示更新完成后调整页面位置的偏移量
    function updateContent(info, container, pile, adjust, adjustOffset) {
        var l = info.updateList.length,
            $updateContent = $(),
            changeID = []; // 记录所有已改变内容的id

        while (l--) {
            // 从最外层开始更新容器内容
            var updateInfo = info.updateList[l],
                selector = updateInfo.containerSelector;

            if ($.isArray(container) && $.inArray(selector, container) < 0) {
                continue;
            }

            var $curContainer = $(selector),
                $container = updateInfo.$container.clone();

            if (!$curContainer.length
                || !$container.length
                || $curContainer.html() === $container.html()) {
                continue;
            }

            var id = updateInfo.id,
                opt = cacheData.pjaxOptions[id];

            opt.updateCallback.call(this, $curContainer, $container, info.href);

            if (!pile || ($.isArray(pile) && !pile[$.inArray(selector, container)])) {
                // 由于脚本在内容通过缓存再次被添加进页面时可以重复执行，因此这里要彻底清除
                $curContainer.empty();
            }

            // 如果选择到的容器不止1个，这样可以将他们分别加入
            $container.each(function(i) {
                $container
                    .eq(i)
                    .contents()
                    .stop()
                    .css('opacity', 0)
                    .appendTo($curContainer.eq(i))
                    .animate({'opacity': 1});
            });

            opt.completeCallback.call(this, $curContainer, $container, info.href);

            $updateContent = $updateContent.add($curContainer);
            changeID[id] = true;
        }

        if (!changeID.length) return;

        if (adjust) adjustPos($updateContent, 0, adjustOffset);

        if (info.title) {
            document.title = info.title;
        }

        // 全部更新完成后，才执行以下代码
        var alreadyActive = {};
        l = cacheData.pjaxOptions.length;
        while (l--) {
            if (!changeID[l]) continue; // 如果该id对应的内容没有发生过变化，则跳过

            opt = cacheData.pjaxOptions[l];

            if (!alreadyActive[opt.active+opt.activeClass]) {
                setActiveNav(opt.active, opt.activeClass, info.href);
                alreadyActive[opt.active+opt.activeClass] = true;
            }

            var $script = info.script && info.script[l];
            if ($script) {
                $body.append($script);
                // 随内容更新的脚本再执行完后应当立即删除
                $script.remove();

                // 但是脚本在内容通过缓存再次被添加进页面时应该可以重新执行一次
                //info.script[id] = undefined; // 保证脚本只被添加并执行一次
            }
        }

        curInfo = info;
    }

    function ajaxUpdate(options, link, href, container, noHistory, noChangeURL, adjust, pile) {
        var self = this;
        options.load.call(self, href, link);

        $.ajax({
            url: href,
            type: 'GET',
            context: this,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-PJAX', true);
                xhr.setRequestHeader('X-PJAX-Container', JSON.stringify(container));
            }

        }).done(function(data) {

            parseHTML(data, href);

            var info = cacheData[href];

            updateContent.call(self, info, container, pile, adjust, options.adjustOffset);
            changeHistory(href, noHistory, noChangeURL);

            options.done.call(self, href, data, link);

        }).fail(function() {
            options.fail.call(self, href, link);
        });
    }

    var defaultOptions = {
        container: 'head,body', // 一个选择器，表示更新异步加载内容的容器。如果需要同时更新多个容器中的内容，则每个容器选择器用“,”隔开。
        // container 也可以是一个数组，每个 container 数组值对应一个 link 数组值。这种设置是为了同时设置不同容器与不同链接间的刷新关系。
        link: '', // 一个选择器，表示链接。点击后使用 ajax 加载内容。如果需要选择多个链接，则每个链接选择器用“,”隔开。
        // link 也可以是一个数组，每个 link 数组值对应一个 container 数组值
        script: '', // 一个script的选择器，将从加载到的HTML中过滤出选择器指定的script标签
        // script 也可以是一个数组，每个 script 数组值对应一个 container 数组值

        active: '', // 一个选择器，表示可以成为焦点的元素。当页面url更新后，会将href属性值与当前url相同的元素添加上焦点类
        activeClass: 'active', // 导航焦点类名

        noCache: false, // 表示是否不缓存更新内容，即每次都重新请求。
        noHistory: false, // 表示是否不新建历史记录，即每次都覆盖当前历史记录。
        noChangeURL: false, // 表示是否不改变当前URL。
        adjust: false, // 表示页面更新完成后是否调整页面位置。
        pile: false, // 表示更新到的内容是否累积到容器中，即不覆盖容器中的内容。
        // 以上五个值都与 link 配置中指定的链接对应（取值也可以为0或1）
        // 如果 link 中指定了多个链接，则以数组的形式与其对应。如果 link 是一个数组，则以二维数组的形式与其对应
        // pile 有些特殊，与 link 对应的每一个值可能并不是简单的布尔值，而是与当前 link 值对应的 container 值中每个容器一一对应的数组，它用来指明不同链接触发的更新在每一个容器中的更新规则
        // 例如：
        // container: '.container1, .container2, .container3',
        // link: '.link1, .link2',
        // pile: [[0,1,0], [0,0,0]],

        noConvertPath: false, // 表示是否不转换页面中所有资源的相对路径。默认关闭，如果确定异步加载的页面与当前页面都在同一目录下，则可以开启。
        adjustOffset: 0, // 如果开启了更新后自动调整，则该值用于设置调整的偏移量。

        load: function(url, link){}, // 加载开始时的回调，将请求的url与导航链接的DOM元素作为参数传入
        done: function(url, data, link){}, // 加载结束时的回调，将请求的url与导航链接的DOM元素以及请求到的data作为参数传入
        fail: function(url, link){}, // 加载结束时的回调，将请求的url与导航链接的DOM元素作为参数传入

        update: function($oldContainerr, $newContainer, href){}, // 更新内容前的回调，如果有多个容器，则每个容器在内容更新前都会调用一次
        complete: function($oldContainer, $newContainer, href){} // 更新内容完成后的回调，如果有多个容器，则每个容器在内容更新完成后都会调用一次
        // $oldContainer 表示旧容器的 jQuery 对象
        // $newContainer 表示新容器的 jQuery 对象，在更新前可以修改该对象，从而改变被更新的内容
        // href 触发内容更新的链接地址
    };

    function Pjax() {
        this._init.apply(this, arguments);
    }

    var p = Pjax.prototype;

    p.constructor = Pjax;

    p._init = function(options) {
        var opt = $.extend({}, defaultOptions, options),
            container = opt.container,
            link = opt.link,
            script = opt.script,

            noCache = opt.noCache,
            noHistory = opt.noHistory,
            noChangeURL = opt.noChangeURL,
            adjust = opt.adjust,
            pile = opt.pile;

        noConvertPath = opt.noConvertPath;

        if (!pjaxID) {
            // 将所有资源的路径转化成绝对路径
            convertAbsPath($(document.documentElement), location.href);

            // 保存当前的 url 以及相关内容信息
            curInfo = {
                href: location.href,
                title: document.title,
                updateList: [],
                script: []
            };

            // 用于保存每个pjax的选择器信息
            cacheData.pjaxOptions = [];
            setCache(cacheData, location.href, curInfo);
            changeHistory(location.href, true);

            if (supportPjax) {
                var self = this;
                window.addEventListener('popstate', function(e) {
                    var href = e.state;
                    if (href && href in cacheData) {
                        updateContent.call(self, cacheData[href]);
                    }
                    window.setTimeout(savePos, 0); // 这里必须异步执行，否则无效
                }, false);
            }
        }

        setActiveNav(opt.active, opt.activeClass, location.href);

        container = $.isArray(container) ? container : [container];
        link = $.isArray(link) ? link : [link];
        script = $.isArray(script) ? script : [script];

        // 如果是数组，但不是二维数组，则将其包装成二维数组。否则直接返回该值
        noCache = $.isArray(noCache) ? $.isArray(noCache[0]) ? noCache : [noCache] : noCache;
        noHistory = $.isArray(noHistory) ? $.isArray(noHistory[0]) ? noHistory : [noHistory] : noHistory;
        noChangeURL = $.isArray(noChangeURL) ? $.isArray(noChangeURL[0]) ? noChangeURL : [noChangeURL] : noChangeURL;
        adjust = $.isArray(adjust) ? $.isArray(adjust[0]) ? adjust : [adjust] : adjust;
        // 如果是数组，但不是三维数组，则将其包装成三维数组。否则直接返回该值
        pile = $.isArray(pile) ? $.isArray(pile[0]) ? $.isArray(pile[0][0]) ? pile : [pile] : [[pile]] : pile;

        var noCacheIsArray = $.isArray(noCache),
            noHistoryIsArray = $.isArray(noHistory),
            noChangeURLIsArray = $.isArray(noChangeURL),
            adjustIsArray = $.isArray(adjust),
            pileIsArray = $.isArray(pile);

        for (var i = 0, l = container.length; i < l; i++) {
            createPjax.call(
                this,
                container[i],
                link[i],
                script[i],
                noCacheIsArray ? noCache[i] : noCache,
                noHistoryIsArray ? noHistory[i] : noHistory,
                noChangeURLIsArray ? noChangeURL[i] : noChangeURL,
                adjustIsArray ? adjust[i] : adjust,
                pileIsArray ? pile[i] : pile,
                opt
            );
        }

        this.options = opt;
    };

    // 通过 update 更新的链接地址不会调用缓存，而是重新请求
    // options 包含以下参数
    // - href 表示要刷新的 url，默认为当前页面的 url
    // - container 表示要刷新容器的选择器，如果需要同时刷新多个容器中的内容，则每个容器选择器用“,”隔开
    //   注意，这里的 container 选择器必须是创建 pjax 对象时指定的容器选择器中包含的，否则将无法更新
    // - noHistory 表示这次刷新是否不新建历史记录
    // - noChangeURL 表示是否不改变当前URL
    // - adjust 表示页面更新完成后是否调整页面位置
    // - pile 表示更新是否累积的规则所组成的数组，该数组中的每一个值和 container 参数中每一个值对应
    p.update = function(options) {
        if (typeof options === 'string') {
            options = { href: options }
        } else {
            options = options || {};
        }

        var href = options.href || window.location.href,
            container = options.container || this.options.container,
            noHistory = options.noHistory,
            noChangeURL = options.noChangeURL,
            adjust = options.adjust,
            pile = options.pile;
        if (container) container = $.map(container.split(','), function(n){ return $.trim(n); });
        ajaxUpdate.call(this, this.options, null, href, container, noHistory, noChangeURL, adjust, pile);
    };

    return Pjax;

}));