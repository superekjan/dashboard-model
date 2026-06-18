const API_BASE = 'http://localhost:3000/api';

const LibLoader = {
    loaded: false,

    async load() {
        if (this.loaded) return true;
        this.loaded = true;

        const libs = [
            { name: 'echarts', check: 'echarts', url: 'https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js' }
        ];

        for (const lib of libs) {
            if (!window[lib.check]) {
                await this.loadScript(lib.url);
            }
        }
        return true;
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => {
                console.warn('库加载失败:', src, '- 使用本地缓存或继续运行');
                resolve();
            };
            document.head.appendChild(script);
        });
    }
};

class NetworkMonitor {
    constructor() {
        this.data = {
            ont: null,
            router: null,
            devices: []
        };
        this.ontTrendChart = null;
        this.ontCurrentMetric = 'web';
        this.router1TrendChart = null;
        this.router1CurrentMetric = 'web';
        this.router2TrendChart = null;
        this.router2CurrentMetric = 'web';
        this.communityCompareChart = null;
        this.floorPlan = null;
        // 感知路由标识码配置（持久化到本地 localStorage）
        this.routerCodes = {
            router1: this.loadConfig('router1Code', 'PKKQGW'),
            router2: this.loadConfig('router2Code', 'PKKQRW')
        };
    }

    // ===== 配置管理（localStorage 持久化） =====
    loadConfig(key, defaultValue) {
        try {
            const value = localStorage.getItem(`network_monitor_${key}`);
            return value || defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }

    saveConfig(key, value) {
        try {
            localStorage.setItem(`network_monitor_${key}`, value);
        } catch (e) {
            console.warn('保存配置失败:', e);
        }
    }

    // 带超时的 fetch
    async fetchWithTimeout(url, options = {}, timeout = 5000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    }

    // ===== 数据查询提示 =====
    showAlert(routerKey, message) {
        const alert = document.getElementById(`${routerKey}Alert`);
        if (alert) {
            alert.textContent = message;
            alert.style.display = 'flex';
        }
    }

    hideAlert(routerKey) {
        const alert = document.getElementById(`${routerKey}Alert`);
        if (alert) {
            alert.style.display = 'none';
        }
    }

    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('visible');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    async init() {
        try {
            await LibLoader.load();
            this.initTime();
            
            try {
                this.initOntTrendChart();
            } catch (e) {
                console.warn('初始化光猫趋势图失败:', e);
            }
            
            try {
                this.initCommunityCompareChart();
            } catch (e) {
                console.warn('初始化小区对比图失败:', e);
            }
            
            try {
                this.initRouter1TrendChart();
            } catch (e) {
                console.warn('初始化路由1趋势图失败:', e);
            }
            
            try {
                this.initRouter2TrendChart();
            } catch (e) {
                console.warn('初始化路由2趋势图失败:', e);
            }
            
            try {
                this.floorPlan3d = new FloorPlan3D('floorPlan3d');
            } catch (e) {
                console.warn('初始化3D户型图失败:', e);
            }
            
            this.initEventListeners();
            await this.fetchData();
            this.startAutoRefresh();
        } catch (e) {
            console.error('初始化失败:', e);
            this.hideLoading();
        }
    }

    initTime() {
        const updateTime = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
            document.getElementById('currentTime').textContent = timeStr;
        };
        updateTime();
        setInterval(updateTime, 1000);
    }

    initRouter1TrendChart() {
        const chartDom = document.getElementById('router1TrendChart');
        if (!chartDom) return;

        this.router1TrendChart = echarts.init(chartDom);
        const option = {
            grid: {
                left: 40,
                right: 15,
                top: 20,
                bottom: 25
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(6, 10, 19, 0.95)',
                borderColor: '#00c8ff',
                textStyle: {
                    color: '#eaf4ff'
                }
            },
            xAxis: {
                type: 'category',
                data: [],
                axisLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.15)' }
                },
                axisLabel: {
                    color: 'rgba(180, 200, 230, 0.5)',
                    fontSize: 9
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.15)' }
                },
                axisLabel: {
                    color: 'rgba(180, 200, 230, 0.5)',
                    fontSize: 9
                },
                splitLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.06)' }
                }
            },
            series: [
                {
                    name: '总感知',
                    type: 'line',
                    data: [],
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 5,
                    lineStyle: {
                        color: '#8b5cf6',
                        width: 2
                    },
                    itemStyle: {
                        color: '#8b5cf6'
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(139, 92, 246, 0.25)' },
                            { offset: 1, color: 'rgba(139, 92, 246, 0)' }
                        ])
                    }
                }
            ]
        };
        this.router1TrendChart.setOption(option);
    }

    initRouter2TrendChart() {
        const chartDom = document.getElementById('router2TrendChart');
        if (!chartDom) return;

        this.router2TrendChart = echarts.init(chartDom);
        const option = {
            grid: {
                left: 40,
                right: 15,
                top: 20,
                bottom: 25
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(6, 10, 19, 0.95)',
                borderColor: '#00c8ff',
                textStyle: {
                    color: '#eaf4ff'
                }
            },
            xAxis: {
                type: 'category',
                data: [],
                axisLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.15)' }
                },
                axisLabel: {
                    color: 'rgba(180, 200, 230, 0.5)',
                    fontSize: 9
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.15)' }
                },
                axisLabel: {
                    color: 'rgba(180, 200, 230, 0.5)',
                    fontSize: 9
                },
                splitLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.06)' }
                }
            },
            series: [
                {
                    name: '总感知',
                    type: 'line',
                    data: [],
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 5,
                    lineStyle: {
                        color: '#f43f5e',
                        width: 2
                    },
                    itemStyle: {
                        color: '#f43f5e'
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(244, 63, 94, 0.25)' },
                            { offset: 1, color: 'rgba(244, 63, 94, 0)' }
                        ])
                    }
                }
            ]
        };
        this.router2TrendChart.setOption(option);
    }

    initOntTrendChart() {
        const chartDom = document.getElementById('ontTrendChart');
        if (!chartDom) return;

        this.ontTrendChart = echarts.init(chartDom);
        const option = {
            grid: {
                left: 40,
                right: 15,
                top: 20,
                bottom: 25
            },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(6, 10, 19, 0.95)',
                borderColor: '#00c8ff',
                textStyle: {
                    color: '#eaf4ff'
                }
            },
            xAxis: {
                type: 'category',
                data: [],
                axisLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.15)' }
                },
                axisLabel: {
                    color: 'rgba(180, 200, 230, 0.5)',
                    fontSize: 9
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.15)' }
                },
                axisLabel: {
                    color: 'rgba(180, 200, 230, 0.5)',
                    fontSize: 9
                },
                splitLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.06)' }
                }
            },
            series: [
                {
                    name: '评分',
                    type: 'line',
                    data: [],
                    smooth: true,
                    symbol: 'circle',
                    symbolSize: 5,
                    lineStyle: {
                        color: '#00c8ff',
                        width: 2
                    },
                    itemStyle: {
                        color: '#00c8ff'
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(0, 200, 255, 0.25)' },
                            { offset: 1, color: 'rgba(0, 200, 255, 0)' }
                        ])
                    }
                }
            ]
        };
        this.ontTrendChart.setOption(option);
    }

    initCommunityCompareChart() {
        const chartDom = document.getElementById('communityCompareChart');
        if (!chartDom) return;

        this.communityCompareChart = echarts.init(chartDom);
        const option = {
            grid: {
                left: 10,
                right: 10,
                top: 15,
                bottom: 25
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                backgroundColor: 'rgba(6, 10, 19, 0.95)',
                borderColor: '#00c8ff',
                textStyle: {
                    color: '#eaf4ff'
                },
                formatter: function(params) {
                    let result = '<div style="font-weight:700;margin-bottom:6px;color:#00c8ff">' + params[0].axisValue + '</div>';
                    params.forEach(item => {
                        result += '<div style="display:flex;justify-content:space-between;gap:20px;margin-top:4px">';
                        result += '<span>' + item.marker + ' ' + item.seriesName + '</span>';
                        result += '<span style="font-weight:600">' + item.value + '分</span>';
                        result += '</div>';
                    });
                    return result;
                }
            },
            xAxis: {
                type: 'category',
                data: ['光猫', '小区平均'],
                axisLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.15)' }
                },
                axisLabel: {
                    color: 'rgba(220, 235, 255, 0.7)',
                    fontSize: 11
                },
                axisTick: {
                    show: false
                }
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLine: { show: false },
                axisLabel: { show: false },
                splitLine: {
                    lineStyle: { color: 'rgba(0, 200, 255, 0.04)' }
                }
            },
            series: [
                {
                    name: '感知分值',
                    type: 'bar',
                    barWidth: '40%',
                    data: [],
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0]
                    },
                    label: {
                        show: true,
                        position: 'top',
                        color: '#eaf4ff',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                        formatter: '{c}分'
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 15,
                            shadowColor: 'rgba(0, 200, 255, 0.4)'
                        }
                    }
                }
            ]
        };
        this.communityCompareChart.setOption(option);
    }

    async fetchData() {
        this.showLoading();

        // 光猫数据
        try {
            const ontResponse = await this.fetchWithTimeout('http://chinaqoe.net/api/hreport_gm/getqoe_month?useruid=GZ1000010462590');
            const ontResult = await ontResponse.json();
            if (ontResult.code === 1) {
                this.parseOntData(ontResult);
            }
        } catch (e) {
            console.warn('获取光猫数据失败，使用模拟数据:', e.message);
        }

        // 感知路由数据（使用配置的标识码）
        await this.fetchRouterData('router1');
        await this.fetchRouterData('router2');

        this.generateMockDevices();
        this.updateUI();
        this.updateOntTrendChart();
        this.updateCommunityCompareChart();
        this.updateRouter1TrendChart();
        this.updateRouter2TrendChart();
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        this.hideLoading();
    }

    // 获取单个感知路由数据（根据配置的标识码）
    async fetchRouterData(routerKey) {
        const code = this.routerCodes[routerKey];
        const isRouter1 = routerKey === 'router1';
        const parseInfo = isRouter1 ? this.parseRouter1Info.bind(this) : this.parseRouter2Info.bind(this);
        const parseTrends = isRouter1 ? this.parseRouter1Trends.bind(this) : this.parseRouter2Trends.bind(this);

        // 清除旧数据，便于判断本次是否查询到新数据
        if (isRouter1) {
            this.data.router1 = null;
        } else {
            this.data.router2 = null;
        }

        let apiResponded = false;

        try {
            const infoRes = await this.fetchWithTimeout(`http://chinaqoe.net/api/hreport_ly/getinfo?useruid=${code}`);
            const info = await infoRes.json();
            apiResponded = true;
            if (info.code === 1) {
                parseInfo(info.result);
            }
        } catch (e) {
            console.warn(`获取感知路由${code}信息失败:`, e.message);
        }

        try {
            const [httpRes, videoRes, gameRes, speedRes] = await Promise.all([
                this.fetchWithTimeout(`http://chinaqoe.net/api/hreport_ly/gethttp_day?useruid=${code}`),
                this.fetchWithTimeout(`http://chinaqoe.net/api/hreport_ly/getvideo_day?useruid=${code}`),
                this.fetchWithTimeout(`http://chinaqoe.net/api/hreport_ly/getgame_day?useruid=${code}`),
                this.fetchWithTimeout(`http://chinaqoe.net/api/hreport_ly/getspeed_day?useruid=${code}`)
            ]);

            const httpData = await httpRes.json();
            const videoData = await videoRes.json();
            const gameData = await gameRes.json();
            const speedData = await speedRes.json();
            apiResponded = true;
            parseTrends({ http: httpData, video: videoData, game: gameData, speed: speedData });
        } catch (e) {
            console.warn(`获取感知路由${code}趋势数据失败:`, e.message);
        }

        // 判断是否查询到数据
        const routerData = isRouter1 ? this.data.router1 : this.data.router2;
        const hasData = routerData && (routerData.basicInfo || (routerData.scoreHistory && routerData.scoreHistory.length > 0));

        if (apiResponded && !hasData) {
            // API 正常响应但无数据，提示标识码可能有误
            this.showAlert(routerKey, `未查询到标识码 "${code}" 的数据，请检查标识码是否正确`);
        } else if (hasData) {
            this.hideAlert(routerKey);
        }

        if (isRouter1) {
            this.updateRouter1Card();
            this.updateRouter1TrendChart();
        } else {
            this.updateRouter2Card();
            this.updateRouter2TrendChart();
        }
    }

    parseRouter1Info(result) {
        if (!this.data.router1) {
            this.data.router1 = {};
        }
        this.data.router1.basicInfo = {
            status: result.onlinestatus === 'online' ? '在线' : '离线',
            operator: result.isp_man || '-'
        };
    }

    parseRouter1Trends(data) {
        if (!this.data.router1) {
            this.data.router1 = {};
        }

        const http = data.http?.code === 1 ? data.http : null;
        const video = data.video?.code === 1 ? data.video : null;
        const game = data.game?.code === 1 ? data.game : null;
        const speed = data.speed?.code === 1 ? data.speed : null;

        const buildMetricMap = (apiData) => {
            const map = new Map();
            if (!apiData) return map;
            apiData.hour?.forEach((time, i) => {
                map.set(time, apiData.qoe[i]);
            });
            return map;
        };

        const httpMap = buildMetricMap(http);
        const videoMap = buildMetricMap(video);
        const gameMap = buildMetricMap(game);
        const speedMap = buildMetricMap(speed);

        const allTimes = new Set([...httpMap.keys(), ...videoMap.keys(), ...gameMap.keys(), ...speedMap.keys()]);
        const sortedTimes = [...allTimes].sort();

        const history = [];
        sortedTimes.forEach(time => {
            const webScore = httpMap.get(time);
            const videoScore = videoMap.get(time);
            const gameScore = gameMap.get(time);
            const downloadScore = speedMap.get(time);

            history.push({
                record_time: time,
                web_score: webScore !== undefined ? Math.round(webScore) : null,
                video_score: videoScore !== undefined ? Math.round(videoScore) : null,
                game_score: gameScore !== undefined ? Math.round(gameScore) : null,
                download_score: downloadScore !== undefined ? Math.round(downloadScore) : null
            });
        });

        this.data.router1.scoreHistory = history;
    }

    parseRouter2Info(result) {
        if (!this.data.router2) {
            this.data.router2 = {};
        }
        this.data.router2.basicInfo = {
            status: result.onlinestatus === 'online' ? '在线' : '离线',
            operator: result.isp_man || '-'
        };
    }

    parseRouter2Trends(data) {
        if (!this.data.router2) {
            this.data.router2 = {};
        }

        const http = data.http?.code === 1 ? data.http : null;
        const video = data.video?.code === 1 ? data.video : null;
        const game = data.game?.code === 1 ? data.game : null;
        const speed = data.speed?.code === 1 ? data.speed : null;

        const buildMetricMap = (apiData) => {
            const map = new Map();
            if (!apiData) return map;
            apiData.hour?.forEach((time, i) => {
                map.set(time, apiData.qoe[i]);
            });
            return map;
        };

        const httpMap = buildMetricMap(http);
        const videoMap = buildMetricMap(video);
        const gameMap = buildMetricMap(game);
        const speedMap = buildMetricMap(speed);

        const allTimes = new Set([...httpMap.keys(), ...videoMap.keys(), ...gameMap.keys(), ...speedMap.keys()]);
        const sortedTimes = [...allTimes].sort();

        const history = [];
        sortedTimes.forEach(time => {
            const webScore = httpMap.get(time);
            const videoScore = videoMap.get(time);
            const gameScore = gameMap.get(time);
            const downloadScore = speedMap.get(time);

            history.push({
                record_time: time,
                web_score: webScore !== undefined ? Math.round(webScore) : null,
                video_score: videoScore !== undefined ? Math.round(videoScore) : null,
                game_score: gameScore !== undefined ? Math.round(gameScore) : null,
                download_score: downloadScore !== undefined ? Math.round(downloadScore) : null
            });
        });

        this.data.router2.scoreHistory = history;
    }

    parseOntData(result) {
        if (!this.data.ont) {
            this.data.ont = {};
        }

        this.data.ont.basicInfo = {
            account: result.kd_id || '-',
            vendor: result.vendor || '-',
            model: result.model || '-',
            bandwidth: result.bandwidth ? `${result.bandwidth}` : '-',
            community: this.filterCommunityName(result.onu_name)
        };

        this.data.ont.score = {
            total_score: result.rage_qoe ? Math.round(result.rage_qoe) : '-',
            web_score: result.rage_http ? Math.round(result.rage_http) : '-',
            video_score: result.rage_video ? Math.round(result.rage_video) : '-',
            ping_score: result.rage_ping ? Math.round(result.rage_ping) : '-',
            game_score: result.rage_game ? Math.round(result.rage_game) : '-'
        };

        this.data.ont.communityScore = result.rage_olt_qoe ? Math.round(result.rage_olt_qoe) : '-';

        if (result.time && result.avg) {
            this.data.ont.scoreHistory = result.time.map((time, i) => ({
                record_time: `${time.substring(0, 4)}-${time.substring(4, 6)}`,
                total_score: Math.round(result.avg[i]),
                web_score: Math.round(result.http[i]),
                video_score: Math.round(result.video[i]),
                ping_score: Math.round(result.ping[i]),
                game_score: Math.round(result.game[i])
            }));
        }
    }

    filterCommunityName(name) {
        if (!name) return '-';
        let filtered = name;
        const chineseRegex = /[\u4e00-\u9fa5]/;
        const firstChineseIndex = [...filtered].findIndex(char => chineseRegex.test(char));
        if (firstChineseIndex > 0) {
            filtered = filtered.substring(firstChineseIndex);
        }
        const match = filtered.match(/^([\u4e00-\u9fa5]+)/);
        return match ? match[1] : filtered;
    }

    generateMockDevices() {
        if (!this.data.ont) {
            this.data.ont = {};
        }

        if (!this.data.ont.basicInfo) {
            this.data.ont.basicInfo = {
                account: 'JD12345678',
                vendor: '华为',
                model: 'HN8346X6',
                bandwidth: '1000',
                community: '华润天合尚悦'
            };
        }

        if (!this.data.ont.score) {
            this.data.ont.score = {
                total_score: 89,
                web_score: 84,
                video_score: 98,
                ping_score: 95,
                game_score: 98
            };
        }

        if (!this.data.ont.scoreHistory) {
            const mockHistory = [];
            const times = ['202504', '202505', '202506', '202507', '202508', '202509', '202510', '202511', '202512', '202601', '202602', '202603'];
            const avgs = [79, 81, 79, 78, 94, 95, 94, 94, 94, 94, 94, 93];
            const https = [72, 74, 71, 71, 89, 91, 90, 89, 89, 89, 90, 88];
            const pings = [87, 88, 87, 85, 98, 99, 98, 99, 98, 99, 98, 98];
            const videos = [100, 97, 100, 100, 94, 100, 93, 98, 98, 98, 98, 96];
            const games = [97, 97, 96, 96, 97, 98, 98, 98, 98, 98, 98, 98];

            times.forEach((time, i) => {
                mockHistory.push({
                    record_time: `${time.substring(0, 4)}-${time.substring(4, 6)}`,
                    total_score: avgs[i],
                    web_score: https[i],
                    video_score: videos[i],
                    ping_score: pings[i],
                    game_score: games[i]
                });
            });
            this.data.ont.scoreHistory = mockHistory;
        }

        const ontDevices = [
            { name: 'FTTR主设备', type: 'fttr', status: 'online', signal: -35, speed: 1000 },
            { name: '客厅电视', type: 'tv', status: 'online', signal: -42, speed: 500 },
            { name: 'iPhone 15', type: 'mobile', status: 'online', signal: -55, speed: 800 },
            { name: 'iPad Pro', type: 'mobile', status: 'online', signal: -48, speed: 600 },
            { name: '小米音箱', type: 'iot', status: 'online', signal: -60, speed: 100 },
            { name: '智能灯泡', type: 'iot', status: 'offline', signal: null, speed: null }
        ];

        const routerDevices = [
            { name: '感知路由', type: 'router', status: 'online', signal: -30, speed: 1200 },
            { name: '小米电视', type: 'tv', status: 'online', signal: -45, speed: 600 },
            { name: 'OPPO Find', type: 'mobile', status: 'online', signal: -52, speed: 900 },
            { name: '海康摄像头', type: 'camera', status: 'online', signal: -58, speed: 200 },
            { name: '打印机', type: 'printer', status: 'offline', signal: null, speed: null },
            { name: '游戏主机', type: 'other', status: 'online', signal: -40, speed: 1000 }
        ];

        if (!this.data.router) {
            this.data.router = {};
        }

        this.data.ont.devices = ontDevices;
        this.data.router.devices = routerDevices;

        const generateScoreHistory = () => {
            const history = [];
            for (let i = 20; i >= 0; i--) {
                const time = new Date();
                time.setMinutes(time.getMinutes() - i * 3);
                history.push({
                    record_time: time.toISOString(),
                    total_score: Math.floor(Math.random() * 20) + 80,
                    web_score: Math.floor(Math.random() * 15) + 80,
                    video_score: Math.floor(Math.random() * 20) + 78,
                    game_score: Math.floor(Math.random() * 25) + 73,
                    download_score: Math.floor(Math.random() * 18) + 80
                });
            }
            return history;
        };

        if (!this.data.router.scoreHistory) {
            this.data.router.scoreHistory = generateScoreHistory();
        }
        if (!this.data.router1) {
            this.data.router1 = {
                basicInfo: {
                    code: 'PKKQGW-20240001',
                    status: '在线',
                    operator: '中国电信'
                },
                scoreHistory: generateScoreHistory()
            };
        }
        if (!this.data.router2) {
            this.data.router2 = {
                basicInfo: {
                    code: 'PKKQRW-20240002',
                    status: '在线',
                    operator: '中国移动'
                },
                scoreHistory: generateScoreHistory()
            };
        }

        if (!this.data.ont.basicInfo) {
            this.data.ont.basicInfo = {
                account: 'JD12345678',
                bandwidth: '1000',
                vendor: '华为',
                model: 'HN8346X6'
            };
        }
        if (!this.data.ont.score) {
            this.data.ont.score = {
                total_score: 92,
                web_score: 95,
                video_score: 90,
                ping_score: 88,
                game_score: 94
            };
        }
        if (!this.data.ont.speed) {
            this.data.ont.speed = {
                avg_speed: 856,
                max_speed: 987
            };
        }

        if (!this.data.router.basicInfo) {
            this.data.router.basicInfo = {
                name: '小米Router',
                model: 'AX9000',
                status: '在线'
            };
        }
        if (!this.data.router.deviceStatus) {
            this.data.router.deviceStatus = {
                temperature: 42,
                cpu_usage: 35,
                memory_usage: 55
            };
        }
        if (!this.data.router.score) {
            this.data.router.score = {
                total_score: 89,
                web_score: 92,
                video_score: 87,
                game_score: 85,
                download_score: 91
            };
        }
    }

    updateUI() {
        this.updateONTCard();
        this.updateRouter1Card();
        this.updateRouter2Card();
    }

    updateONTCard() {
        const ont = this.data.ont;
        if (!ont) return;

        document.getElementById('ontAccount').textContent = this.maskAccount(ont.basicInfo.account) || '-';
        document.getElementById('ontVendor').textContent = ont.basicInfo.vendor || '-';
        document.getElementById('ontModel').textContent = ont.basicInfo.model || '-';
        document.getElementById('ontBandwidth').textContent = ont.basicInfo.bandwidth ? `${ont.basicInfo.bandwidth} Mbps` : '-';

        const score = ont.score;
        if (score) {
            document.getElementById('ontTotalScore').textContent = score.total_score || '-';
            document.getElementById('ontWebScore').textContent = score.web_score || '-';
            document.getElementById('ontVideoScore').textContent = score.video_score || '-';
            document.getElementById('ontPingScore').textContent = score.ping_score || '-';
            document.getElementById('ontGameScore').textContent = score.game_score || '-';
        }

        const compareTitle = document.getElementById('compareTitle');
        if (compareTitle && ont.basicInfo.community) {
            compareTitle.textContent = ont.basicInfo.community;
        }
    }

    maskAccount(account) {
        if (!account || account.length <= 8) return account;
        return account.slice(0, 4) + '*'.repeat(account.length - 8) + account.slice(-4);
    }

    updateCommunityCompareChart() {
        if (!this.communityCompareChart) return;

        const ontScore = this.data.ont?.score?.total_score;
        const communityScore = this.data.ont?.communityScore;

        const ontValue = typeof ontScore === 'number' ? ontScore : 0;
        const communityValue = typeof communityScore === 'number' ? communityScore : 0;

        const colors = [
            new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#00c8ff' },
                { offset: 1, color: '#0088aa' }
            ]),
            new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#8b5cf6' },
                { offset: 1, color: '#6d28d9' }
            ])
        ];

        this.communityCompareChart.setOption({
            series: [{
                data: [
                    {
                        value: ontValue,
                        itemStyle: { color: colors[0] }
                    },
                    {
                        value: communityValue,
                        itemStyle: { color: colors[1] }
                    }
                ]
            }]
        });
    }

    updateRouter1Card() {
        const router1 = this.data.router1;
        if (!router1 || !router1.basicInfo) {
            document.getElementById('router1Status').textContent = '-';
            document.getElementById('router1Operator').textContent = '-';
            this.updateRouter1TrendChart();
            return;
        }

        document.getElementById('router1Status').textContent = router1.basicInfo.status || '-';
        document.getElementById('router1Operator').textContent = router1.basicInfo.operator || '-';

        this.updateRouter1TrendChart();
    }

    updateRouter2Card() {
        const router2 = this.data.router2;
        if (!router2 || !router2.basicInfo) {
            document.getElementById('router2Status').textContent = '-';
            document.getElementById('router2Operator').textContent = '-';
            this.updateRouter2TrendChart();
            return;
        }

        document.getElementById('router2Status').textContent = router2.basicInfo.status || '-';
        document.getElementById('router2Operator').textContent = router2.basicInfo.operator || '-';

        this.updateRouter2TrendChart();
    }

    updateStatusClass(statusId, valueId, value, threshold, isNegative = false) {
        const statusEl = document.getElementById(statusId);
        const valueEl = document.getElementById(valueId);
        if (!statusEl || !valueEl) return;

        statusEl.classList.remove('warning', 'danger');
        valueEl.style.color = '';

        if (isNegative) {
            if (value < threshold) {
                statusEl.classList.add('danger');
                valueEl.style.color = '#ff006e';
            }
        } else {
            if (value > threshold) {
                statusEl.classList.add(value > threshold * 1.2 ? 'danger' : 'warning');
                valueEl.style.color = value > threshold * 1.2 ? '#ff006e' : '#fee440';
            }
        }
    }

    updateScoreRing(ringId, valueId, score) {
        const ring = document.getElementById(ringId);
        const value = document.getElementById(valueId);
        if (!ring || !value) return;

        const circumference = 2 * Math.PI * 85;
        const offset = circumference - (circumference * score / 100);

        ring.style.strokeDashoffset = offset;
        value.textContent = score || '-';

        ring.classList.remove('warning', 'danger');
        if (score < 60) {
            ring.classList.add('danger');
        } else if (score < 80) {
            ring.classList.add('warning');
        }
    }

    updateRouter1TrendChart() {
        if (!this.router1TrendChart) return;

        const routerHistory = this.data.router1?.scoreHistory || [];
        const labels = routerHistory.map(h => this.formatTime(h.record_time));

        let metricData;
        switch (this.router1CurrentMetric) {
            case 'video':
                metricData = routerHistory.map(h => h.video_score);
                break;
            case 'game':
                metricData = routerHistory.map(h => h.game_score);
                break;
            case 'download':
                metricData = routerHistory.map(h => h.download_score);
                break;
            default:
                metricData = routerHistory.map(h => h.web_score);
        }

        this.router1TrendChart.setOption({
            xAxis: { data: labels },
            series: [
                { data: metricData }
            ]
        });
    }

    updateRouter2TrendChart() {
        if (!this.router2TrendChart) return;

        const routerHistory = this.data.router2?.scoreHistory || [];
        const labels = routerHistory.map(h => this.formatTime(h.record_time));

        let metricData;
        switch (this.router2CurrentMetric) {
            case 'video':
                metricData = routerHistory.map(h => h.video_score);
                break;
            case 'game':
                metricData = routerHistory.map(h => h.game_score);
                break;
            case 'download':
                metricData = routerHistory.map(h => h.download_score);
                break;
            default:
                metricData = routerHistory.map(h => h.web_score);
        }

        this.router2TrendChart.setOption({
            xAxis: { data: labels },
            series: [
                { data: metricData }
            ]
        });
    }

    updateOntTrendChart() {
        if (!this.ontTrendChart) return;

        const ontHistory = this.data.ont?.scoreHistory || [];
        const labels = ontHistory.map(h => this.formatTime(h.record_time));

        let metricData;
        switch (this.ontCurrentMetric) {
            case 'video':
                metricData = ontHistory.map(h => h.video_score);
                break;
            case 'game':
                metricData = ontHistory.map(h => h.game_score);
                break;
            case 'download':
                metricData = ontHistory.map(h => h.download_score);
                break;
            default:
                metricData = ontHistory.map(h => h.web_score);
        }

        this.ontTrendChart.setOption({
            xAxis: { data: labels },
            series: [
                { data: metricData }
            ]
        });
    }

    formatTime(timeStr) {
        if (!timeStr) return '';
        if (/^\d{2}-\d{2}\s\d{2}$/.test(timeStr)) {
            return timeStr;
        }
        if (/^\d{4}-\d{2}$/.test(timeStr)) {
            return timeStr;
        }
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return timeStr;
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    initEventListeners() {
        document.querySelectorAll('#ontCard .inline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#ontCard .inline-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.ontCurrentMetric = e.target.dataset.metric;
                this.updateOntTrendChart();
            });
        });

        document.querySelectorAll('#router1Card .router-selector .inline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#router1Card .router-selector .inline-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.router1CurrentMetric = e.target.dataset.metric;
                this.updateRouter1TrendChart();
            });
        });

        document.querySelectorAll('#router2Card .router-selector .inline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#router2Card .router-selector .inline-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.router2CurrentMetric = e.target.dataset.metric;
                this.updateRouter2TrendChart();
            });
        });

        // 感知路由标识码编辑
        this.initRouterCodeEditor('router1');
        this.initRouterCodeEditor('router2');
    }

    // 感知路由标识码内联编辑
    initRouterCodeEditor(routerKey) {
        const codeText = document.getElementById(`${routerKey}Code`);
        const codeInput = document.getElementById(`${routerKey}CodeInput`);
        const editBtn = document.getElementById(`${routerKey}EditBtn`);
        const saveBtn = document.getElementById(`${routerKey}SaveBtn`);
        const cancelBtn = document.getElementById(`${routerKey}CancelBtn`);
        if (!codeText || !codeInput || !editBtn || !saveBtn || !cancelBtn) return;

        // 初始化显示本地配置中的标识码
        codeText.textContent = this.routerCodes[routerKey];

        const enterEditMode = () => {
            codeText.style.display = 'none';
            codeInput.style.display = 'inline-block';
            codeInput.value = this.routerCodes[routerKey];
            editBtn.style.display = 'none';
            saveBtn.style.display = 'flex';
            cancelBtn.style.display = 'flex';
            codeInput.focus();
            codeInput.select();
        };

        const exitEditMode = () => {
            codeText.style.display = 'inline';
            codeInput.style.display = 'none';
            editBtn.style.display = 'flex';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        };

        editBtn.addEventListener('click', enterEditMode);
        cancelBtn.addEventListener('click', exitEditMode);

        saveBtn.addEventListener('click', async () => {
            const newCode = codeInput.value.trim().toUpperCase();
            if (!newCode) {
                this.showAlert(routerKey, '标识码不能为空');
                exitEditMode();
                return;
            }
            if (newCode === this.routerCodes[routerKey]) {
                exitEditMode();
                return;
            }
            // 保存新标识码到本地配置
            this.routerCodes[routerKey] = newCode;
            this.saveConfig(`${routerKey}Code`, newCode);
            codeText.textContent = newCode;
            exitEditMode();
            // 根据新标识码重新获取数据
            this.showLoading();
            await this.fetchRouterData(routerKey);
            this.hideLoading();
        });

        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            } else if (e.key === 'Escape') {
                exitEditMode();
            }
        });
    }

    startAutoRefresh() {
        const scheduleNextHour = () => {
            const now = new Date();
            const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
            const delay = nextHour - now;

            setTimeout(() => {
                this.fetchData();
                scheduleNextHour();
            }, delay);
        };

        scheduleNextHour();
    }

    handleResize() {
        if (this.ontTrendChart) this.ontTrendChart.resize();
        if (this.communityCompareChart) this.communityCompareChart.resize();
        if (this.router1TrendChart) this.router1TrendChart.resize();
        if (this.router2TrendChart) this.router2TrendChart.resize();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const monitor = new NetworkMonitor();
    monitor.init();

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => monitor.handleResize(), 200);
    });
});