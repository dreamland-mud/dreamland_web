<?xml version='1.0' encoding='UTF-8'?><!-- -*- indent-tabs-mode: nil -*- -->

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns="http://www.w3.org/1999/html"
                version="1.0">

<xsl:output method="html" />

<xsl:template match="/page">
        <html lang="ru">
            <xsl:apply-templates select="head" />      
            <body>
                <xsl:apply-templates select="header" />      
                <xsl:apply-templates select="content" />
                <xsl:apply-templates select="footer" />      
            </body>
        </html>
</xsl:template>

<xsl:template match="@* | node()">
    <xsl:copy>
        <xsl:apply-templates select="@* | node()"/>
    </xsl:copy>
</xsl:template>

<xsl:template match="head">
	<head>
            <meta charset="utf-8"/>
            <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
		 <!-- The above 3 meta tags *must* come first in the head; any other head content must come *after* these tags -->
                 <meta name="Description" CONTENT="DreamLand MUD (Мир Грез, Мир Снов, Dream Land, МУД, МАД) текстовая многопользовательская бесплатная ролевая онлайн игра на тематику фентези"/>
                <xsl:copy-of select="*" />

		<!-- Bootstrap -->
		<link type="text/css" rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css"/>

		<!-- Custom stlylesheet -->
		<link type="text/css" rel="stylesheet" href="css/style.css?4"/>

		<!-- Google font -->
                <link href="https://fonts.googleapis.com/css?family=Lato:700%7CMontserrat:400,600" rel="stylesheet"/>

		<!-- HTML5 shim and Respond.js for IE8 support of HTML5 elements and media queries -->
		<!-- WARNING: Respond.js doesn't work if you view the page via file:// -->
		<!--[if lt IE 9]>
		  <script src="https://oss.maxcdn.com/html5shiv/3.7.3/html5shiv.min.js"></script>
		  <script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>
		<![endif]-->
                <xsl:call-template name="snippet"/>
<!-- Facebook Pixel Code -->
<script>
<![CDATA[
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '471143563696749');
  fbq('track', 'PageView');
]]>
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=471143563696749&amp;ev=PageView&amp;noscript=1" /></noscript>
<!-- End Facebook Pixel Code -->
</head>
</xsl:template>

<xsl:template match="header">
    <header id="header" class="transparent-nav">
            <div class="container">
                    <div class="navbar-header">
                            <div class="navbar-brand">
                                    <a class="logo" href="index.html">
                                        <img src="./img/logo-alt.png" alt="logo"/>
                                    </a>
                            </div>

                            <button class="navbar-toggle">
                                    <span></span>
                            </button>
                    </div>
                    <nav id="nav">
                            <ul class="main-menu nav navbar-nav navbar-right">
                                    <li><a href="index.html">Главная</a></li>
                                    <li><a href="https://dreamland.rocks/mudjs">Играть</a></li>
                                    <li><a href="maps.html">Карты</a></li>
                                    <li><a href="searcher.html">Вещи</a></li>
                                    <li><a href="index.html#why-us">Разработка</a></li>
                                    <li class="hidden-md hidden-sm"><a href="news.html">Новости</a></li>
                                    <li class="hidden-md hidden-sm"><a href="stories.html">Легенды</a></li>
                                    <li class="hidden-md hidden-sm"><a href="links.html">Ссылки</a></li>
                            </ul>
                    </nav>
            </div>
    </header>
</xsl:template>

<xsl:template match="footer">
		<footer id="footer" class="section">
			<div class="container">
				<div class="row">
					<div class="col-md-2">
						<div class="footer-logo">
							<a class="logo" href="index.html">
                                                                <b>DreamLand</b>
							</a>
						</div>
					</div>

					<div class="col-md-10">
						<ul class="footer-nav">
                                                    <li><a href="index.html">Главная</a></li>
                                                    <li><a href="https://dreamland.rocks/mudjs">Играть</a></li>
                                                    <li><a href="maps.html">Карты</a></li>
                                                    <li><a href="searcher.html">Вещи</a></li>
                                                    <li><a href="index.html#why-us">Разработка</a></li>
                                                    <li><a href="news.html">Новости</a></li>
                                                    <li><a href="stories.html">Легенды</a></li>
                                                    <li><a href="links.html">Ссылки</a></li>
                                                    <li><a href="index.html#contact">Контакт</a></li>
						</ul>
					</div>
				</div>

				<div id="bottom-footer" class="row">
                                        <div class="col-md-4 col-md-push-8">
                                        <!--
						<ul class="footer-social">
							<li><a href="https://plus.google.com/100935392158446743578" class="google-plus"><i class="fab fa-google-plus-f"></i></a></li>
                                                        <li><a href="https://www.facebook.com/dreamland.mud" class="facebook"><i class="fab fa-facebook-f"></i></a></li>
                                                </ul>
                                        -->
					</div>

					<div class="col-md-12">
						<div class="footer-copyright">
                                                    <span>Copyright 2018. All Rights Reserved. | This template is made with <i class="fa fa-heart-o" aria-hidden="true"></i> by <a href="https://colorlib.com">Colorlib</a></span><span> | Images by <a href="https://www.shutterstock.com/ru/g/unicornstail">Miyu Nur</a></span>
						</div>
					</div>
				</div>
			</div>
		</footer>

		<script type="text/javascript" src="https://code.jquery.com/jquery-2.2.4.min.js"></script>
		<script type="text/javascript" src="https://stackpath.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
		<script type="text/javascript" src="js/main.js"></script>
                <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.2.0/css/solid.css" integrity="sha384-wnAC7ln+XN0UKdcPvJvtqIH3jOjs9pnKnq9qX68ImXvOGz2JuFoEiCjT8jyZQX2z" crossorigin="anonymous"/>
                <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.2.0/css/brands.css" integrity="sha384-nT8r1Kzllf71iZl81CdFzObMsaLOhqBU1JD2+XoAALbdtWaXDOlWOZTR4v1ktjPE" crossorigin="anonymous"/>
                <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.2.0/css/fontawesome.css" integrity="sha384-HbmWTHay9psM8qyzEKPc8odH4DsOuzdejtnr+OFtDmOcIVnhgReQ4GZBH7uwcjf6" crossorigin="anonymous"/>
                <xsl:copy-of select="*"/>
</xsl:template>

<xsl:template name="snippet">
  <script type="application/ld+json">
  {
  "@context": "http://schema.org",
  "@type": "VideoGame",
  "name": "DreamLand MUD",
  "description": "DreamLand MUD (Мир Грез, Мир Снов, Dream Land, МУД, МАД) текстовая многопользовательская бесплатная ролевая онлайн игра на тематику фентези",
  "url": "https://dreamland.rocks",
  "image": "/img/large-greeting.png",
  "playMode": "MultiPlayer",
  "gamePlatform": ["Online_gaming_services", "PC game"],
  "operatingSystem": ["Linux", "Windows", "MacOS"],
  "applicationCategory": "Game, Multimedia",
  "applicationSubCategory": "MUD",
  "inLanguage":["Russian","English"],
  "genre":["Role-playing game", "MUD"],
  "gameServer": {
    "name": "dreamland.rocks",
    "url":"78.46.175.102:9000",
    "serverStatus": "Online"
  },
  "sameAs": ["http://mudconnector.su/DreamLand","http://www.mudconnect.com/cgi-bin/adv_search.cgi?Mode=MUD&amp;mud=DreamLand", "https://plus.google.com/100935392158446743578"]
}
   </script>
</xsl:template>

<!-- Replace color pseudo-tags "c" with span and color classes. -->
<xsl:template match="c">
    <span class="{@t}"><xsl:value-of select="."/></span>
</xsl:template>

<!-- News -->
<xsl:template match="node" mode="news">
<pre class="for-panel">
    <div class="panel panel-default">
        <div class="panel-heading"><span class="news-date"><xsl:apply-templates select="date"/>&#160;<xsl:apply-templates select="from"/></span>&#160;<span class="news-subject"><xsl:value-of select="subject"/></span></div>
            <div class="panel-body"> <xsl:apply-templates select="text"/> </div>
    </div>
</pre>
</xsl:template>

<xsl:template match="news-dump">
    <xsl:apply-templates select="document('news-dump.xml')/NoteBucket/node" mode="news">
            <xsl:sort select="id" order="descending" /> 
    </xsl:apply-templates>
</xsl:template>                                            

<!-- Stories. -->
<xsl:template match="node" mode="story">
<pre class="terminal">
    <div>
        <span class="story-author">[<xsl:value-of select="date"/><xsl:text>] </xsl:text><xsl:value-of select="from"/>:<xsl:text> </xsl:text></span> 
        <span class="story-title"><xsl:value-of select="subject"/></span>
    </div>
    <br/>
    <div class="story-text">
        <xsl:apply-templates select="text"/>
    </div>
</pre>
</xsl:template>

<xsl:template match="stories-dump">
    <xsl:apply-templates select="document('stories-dump.xml')/NoteBucket/node" mode="story">
            <xsl:sort select="id" order="ascending" /> 
    </xsl:apply-templates>
</xsl:template>

<xsl:template match="samurai-dump">
    <xsl:apply-templates select="document('samurai-dump.xml')/NoteBucket/node" mode="story">
            <xsl:sort select="id" order="ascending" /> 
    </xsl:apply-templates>
</xsl:template>

<!-- Legends -->
<xsl:template match="legends-dump">
    <xsl:apply-templates select="document('legends-dump.xml')/book/node" mode="content">
            <xsl:sort select="keyword" order="descending" /> 
    </xsl:apply-templates>    
</xsl:template>

<xsl:template match="legends-toc">
    <xsl:apply-templates select="document('legends-dump.xml')/book/node" mode="toc">
        <xsl:sort select="keyword" order="descending" /> 
    </xsl:apply-templates>
</xsl:template>

<xsl:template match="/book/node" mode="toc">
    <tr>
        <td width="20%"><span class="tag-cc"><a href="{concat('#',@keyword)}"><xsl:value-of select="@author"/></a></span></td>
        <td width="80%"><span class="tag-ww"><a href="{concat('#',@keyword)}"><xsl:value-of select="@title"/></a></span></td>
    </tr>
</xsl:template>

<xsl:template match="/book/node" mode="content">
<pre class="for-panel">
    <div class="panel panel-default" id="{concat('',@keyword)}">
        <div class="panel-heading"><span class="news-date"><xsl:value-of select="@author"/></span>&#160;<span class="news-subject"><xsl:value-of select="@title"/></span></div>
            <div class="panel-body"> <xsl:apply-templates select="node()"/> </div>
    </div>
</pre>
</xsl:template>

</xsl:stylesheet>
