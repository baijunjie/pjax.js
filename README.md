# pjax

可前端独立执行的 pjax，同时请求中也会携带连个ajax请求头，方便后端做优化兼容
```js
xhr.setRequestHeader("X-PJAX", true); // 表明是 pjax 请求
xhr.setRequestHeader("X-PJAX-Container", container); // 表明是当前需要请求的内容容器选择器所组成的数组
```

## 依赖插件
[[iscroll-zoom.js]](http://jquery.com/)


## 调用方法
```js
pjax({
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
});
```

## AMD
```js
require(["pjax"], function(pjax) {
	pjax({
		container: "#index_pageCxt, #midContent .sideBar, #topHeader .dongtai",
		link: "#midContent a, #footer a",
		active: "#midContent a",
		load: function() {
			window.bjj.progress.start();
		},
		done: function(url) {
			window.bjj.progress.done();
		},
		fail: function(url) {
			alert("您所请求的内容不存在！\n" + url);
			window.bjj.progress.fail();
		}
	});
});
```


## 主要原理

1) 只要页面引入pjax.js文件，即使不做任何调用，初始化时，将页面的所有外部链接地址转化为绝对路径。
2) 如果浏览器支持history.replaceState，则使用history.replaceState替换掉当前的历史记录点，保证以后回退到初始url时不会出错。
2) 调用pjax方法后，会根据配置信息，检查所有焦点元素，将href属性值与当前url相同的元素添加上焦点类。
3) 如果浏览器不支持 history.pushState 则到此为止。
4) 如果浏览器支持，先缓存当前页面的 href 以及对应的内容。
5) 点击链接后，根据链接的 href 检查缓存，判断是否已经被加载。如果 href 已经被加载，那么读取缓存。如果没有加载，则用 ajax 去加载。
6) 拿到内容信息后，先将内容缓存，然后保存历史记录点，并将请求的 href 作为记录点的数据，最后为容器替换新内容。
7) 监听 popstate 事件，在事件触发时根据得到的 href 拿到缓存的内容信息。




## 经验总结

### 页面总是回到顶部的问题

使用 pushState 方法时，浏览器会记录页面当前的 scroll 值，并保存在上一条的历史记录中。
但在 chrome 浏览器上发现，浏览器好像并不会去获取页面的 scrollTop/scrollLeft，而是有自己的一套记录机制。

这导致了两个问题：
1) 如果两次修改历史记录期间没有滚动过页面，那么上一条历史记录的 scrollTop/scrollLeft 就会为0，当后退到该记录点时，页面会回到文档顶部。
- 解决方案是，在页面添加历史记录点前，应该使用页面的 scrollTop/scrollLeft 属性加1减1，来强制浏览器记录当前的scroll位置。

2) 回退到前一条历史时，如果不滚动页面，当加载新链接时，页面还是会回到文档顶部。
- 解决方案是，在 popstate 事件处理函数中强制浏览器记录当前的scroll位置。但是这里必须异步执行，同步执行无效。

后来测试，IE和火狐都没有这个问题。




