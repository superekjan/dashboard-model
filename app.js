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
        this.router3TrendChart = null;
        this.router3CurrentMetric = 'web';
        this.communityCompareChart = null;
        this.floorPlan = null;
        // 感知路由标识码配置（持久化到本地 localStorage）
        this.routerCodes = {
            router1: this.loadConfig('router1Code', 'PKKQ6G'),
            router2: this.loadConfig('router2Code', 'PKKQKK'),
            router3: this.loadConfig('router3Code', 'PKKQT9')
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
            
            // 初始化标识码显示（从 localStorage 读取并同步到卡片）
            this.updateRouterCodeDisplays();
            
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
                this.initRouter3TrendChart();
            } catch (e) {
                console.warn('初始化路由3趋势图失败:', e);
            }

            try {
                this.floorPlan3d = new FloorPlan3D('floorPlan3d');
                // 绑定户型图设备点击回调，弹出设备信息窗口
                this.floorPlan3d.onDeviceClick = (name, type) => {
                    this.showDeviceModal(name, type);
                };
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

    initRouter3TrendChart() {
        const chartDom = document.getElementById('router3TrendChart');
        if (!chartDom) return;

        this.router3TrendChart = echarts.init(chartDom);
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
                        color: '#fbbf24',
                        width: 2
                    },
                    itemStyle: {
                        color: '#fbbf24'
                    },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(251, 191, 36, 0.25)' },
                            { offset: 1, color: 'rgba(251, 191, 36, 0)' }
                        ])
                    }
                }
            ]
        };
        this.router3TrendChart.setOption(option);
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
            const ontResponse = await this.fetchWithTimeout('https://chinaqoe.net/api/hreport_gm/getqoe_month?useruid=GZ1000010462590');
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
        await this.fetchRouterData('router3');

        this.generateMockDevices();
        this.updateUI();
        this.updateOntTrendChart();
        this.updateCommunityCompareChart();
        this.updateRouter1TrendChart();
        this.updateRouter2TrendChart();
        this.updateRouter3TrendChart();
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        this.hideLoading();
    }

    // 获取单个感知路由数据（根据配置的标识码）
    async fetchRouterData(routerKey) {
        const code = this.routerCodes[routerKey];
        const config = this.getRouterConfig(routerKey);
        if (!config) return;
        const parseInfo = config.parseInfo.bind(this);
        const parseTrends = config.parseTrends.bind(this);

        // 清除旧数据，便于判断本次是否查询到新数据
        this.data[routerKey] = null;

        let apiResponded = false;

        try {
            const infoRes = await this.fetchWithTimeout(`https://chinaqoe.net/api/hreport_ly/getinfo?useruid=${code}`);
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
                this.fetchWithTimeout(`https://chinaqoe.net/api/hreport_ly/gethttp_day?useruid=${code}`),
                this.fetchWithTimeout(`https://chinaqoe.net/api/hreport_ly/getvideo_day?useruid=${code}`),
                this.fetchWithTimeout(`https://chinaqoe.net/api/hreport_ly/getgame_day?useruid=${code}`),
                this.fetchWithTimeout(`https://chinaqoe.net/api/hreport_ly/getspeed_day?useruid=${code}`)
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
        const routerData = this.data[routerKey];
        const hasData = routerData && (routerData.basicInfo || (routerData.scoreHistory && routerData.scoreHistory.length > 0));

        if (apiResponded && !hasData) {
            // API 正常响应但无数据，提示标识码可能有误
            this.showAlert(routerKey, `未查询到标识码 "${code}" 的数据，请检查标识码是否正确`);
        } else if (hasData) {
            this.hideAlert(routerKey);
        }

        config.updateCard.call(this);
        config.updateChart.call(this);
    }

    // 路由器配置映射：统一管理各路由的解析与更新方法
    getRouterConfig(routerKey) {
        const configs = {
            router1: {
                parseInfo: this.parseRouter1Info,
                parseTrends: this.parseRouter1Trends,
                updateCard: this.updateRouter1Card,
                updateChart: this.updateRouter1TrendChart
            },
            router2: {
                parseInfo: this.parseRouter2Info,
                parseTrends: this.parseRouter2Trends,
                updateCard: this.updateRouter2Card,
                updateChart: this.updateRouter2TrendChart
            },
            router3: {
                parseInfo: this.parseRouter3Info,
                parseTrends: this.parseRouter3Trends,
                updateCard: this.updateRouter3Card,
                updateChart: this.updateRouter3TrendChart
            }
        };
        return configs[routerKey];
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

    parseRouter3Info(result) {
        if (!this.data.router3) {
            this.data.router3 = {};
        }
        this.data.router3.basicInfo = {
            status: result.onlinestatus === 'online' ? '在线' : '离线',
            operator: result.isp_man || '-'
        };
    }

    parseRouter3Trends(data) {
        if (!this.data.router3) {
            this.data.router3 = {};
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

        this.data.router3.scoreHistory = history;
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
        if (!this.data.router3) {
            this.data.router3 = {
                basicInfo: {
                    code: 'PKKQTW-20240003',
                    status: '在线',
                    operator: '中国联通'
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
        this.updateRouter3Card();
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

        // 更新3D户型图中光猫的状态与最新感知分值
        if (this.floorPlan3d) {
            const ontScore = (score && typeof score.total_score === 'number') ? score.total_score : undefined;
            this.floorPlan3d.updateDeviceStatus('光猫', '在线', ontScore);
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
            document.getElementById('router1Score').textContent = '-';
            this.updateRouter1TrendChart();
            return;
        }

        document.getElementById('router1Status').textContent = router1.basicInfo.status || '-';
        document.getElementById('router1Operator').textContent = router1.basicInfo.operator || '-';

        // 更新最新感知分值显示
        const latestScore = this.getLatestScore('router1');
        const router1ScoreEl = document.getElementById('router1Score');
        if (router1ScoreEl) {
            if (router1.scoreHistory && router1.scoreHistory.length > 0) {
                router1ScoreEl.textContent = latestScore;
                router1ScoreEl.style.color = this.getScoreColor(latestScore);
            } else {
                router1ScoreEl.textContent = '-';
                router1ScoreEl.style.color = '';
            }
        }

        // 更新3D模型状态显示
        if (this.floorPlan3d) {
            const floorScore = (router1.scoreHistory && router1.scoreHistory.length > 0) ? latestScore : undefined;
            this.floorPlan3d.updateDeviceStatus('路由1', router1.basicInfo.status, floorScore);
        }

        this.updateRouter1TrendChart();
    }

    updateRouter2Card() {
        const router2 = this.data.router2;
        if (!router2 || !router2.basicInfo) {
            document.getElementById('router2Status').textContent = '-';
            document.getElementById('router2Operator').textContent = '-';
            document.getElementById('router2Score').textContent = '-';
            this.updateRouter2TrendChart();
            return;
        }

        document.getElementById('router2Status').textContent = router2.basicInfo.status || '-';
        document.getElementById('router2Operator').textContent = router2.basicInfo.operator || '-';

        // 更新最新感知分值显示
        const latestScore = this.getLatestScore('router2');
        const router2ScoreEl = document.getElementById('router2Score');
        if (router2ScoreEl) {
            if (router2.scoreHistory && router2.scoreHistory.length > 0) {
                router2ScoreEl.textContent = latestScore;
                router2ScoreEl.style.color = this.getScoreColor(latestScore);
            } else {
                router2ScoreEl.textContent = '-';
                router2ScoreEl.style.color = '';
            }
        }

        // 更新3D模型状态显示
        if (this.floorPlan3d) {
            const floorScore = (router2.scoreHistory && router2.scoreHistory.length > 0) ? latestScore : undefined;
            this.floorPlan3d.updateDeviceStatus('路由2', router2.basicInfo.status, floorScore);
        }

        this.updateRouter2TrendChart();
    }

    updateRouter3Card() {
        const router3 = this.data.router3;
        if (!router3 || !router3.basicInfo) {
            document.getElementById('router3Status').textContent = '-';
            document.getElementById('router3Operator').textContent = '-';
            document.getElementById('router3Score').textContent = '-';
            this.updateRouter3TrendChart();
            return;
        }

        document.getElementById('router3Status').textContent = router3.basicInfo.status || '-';
        document.getElementById('router3Operator').textContent = router3.basicInfo.operator || '-';

        // 更新最新感知分值显示
        const latestScore = this.getLatestScore('router3');
        const router3ScoreEl = document.getElementById('router3Score');
        if (router3ScoreEl) {
            if (router3.scoreHistory && router3.scoreHistory.length > 0) {
                router3ScoreEl.textContent = latestScore;
                router3ScoreEl.style.color = this.getScoreColor(latestScore);
            } else {
                router3ScoreEl.textContent = '-';
                router3ScoreEl.style.color = '';
            }
        }

        // 更新3D模型状态显示
        if (this.floorPlan3d) {
            const floorScore = (router3.scoreHistory && router3.scoreHistory.length > 0) ? latestScore : undefined;
            this.floorPlan3d.updateDeviceStatus('路由3', router3.basicInfo.status, floorScore);
        }

        this.updateRouter3TrendChart();
    }

    // 获取路由的最新感知分数
    getLatestScore(routerKey) {
        const data = this.data[routerKey];
        if (!data?.scoreHistory || data.scoreHistory.length === 0) return 100;
        const latest = data.scoreHistory[data.scoreHistory.length - 1];
        return latest.web_score ?? latest.video_score ?? latest.game_score ?? latest.download_score ?? 100;
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
        if (score < 85) {
            ring.classList.add('danger');
        } else if (score < 90) {
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

        // 为每个数据点设置颜色
        const coloredData = metricData.map(score => ({
            value: score,
            itemStyle: {
                color: this.getScoreColor(score)
            }
        }));

        this.router1TrendChart.setOption({
            xAxis: { data: labels },
            series: [
                { 
                    type: 'bar',
                    data: coloredData
                }
            ]
        });
    }
s
    // 根据分数返回颜色（使用项目风格定义的提示色）
    getScoreColor(score) {
        if (score < 85) return '#f43f5e';   // 红色（<85）- 对应 --accent-danger
        if (score < 90) return '#fbbf24';   // 黄色（85-89）- 对应 --accent-warning
        return '#34d399';                    // 绿色（>=90）- 对应 --accent-success
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

        // 为每个数据点设置颜色
        const coloredData = metricData.map(score => ({
            value: score,
            itemStyle: {
                color: this.getScoreColor(score)
            }
        }));

        this.router2TrendChart.setOption({
            xAxis: { data: labels },
            series: [
                { 
                    type: 'bar',
                    data: coloredData
                }
            ]
        });
    }

    updateRouter3Card() {
        const router3 = this.data.router3;
        if (!router3 || !router3.basicInfo) {
            document.getElementById('router3Status').textContent = '-';
            document.getElementById('router3Operator').textContent = '-';
            document.getElementById('router3Score').textContent = '-';
            this.updateRouter3TrendChart();
            return;
        }

        document.getElementById('router3Status').textContent = router3.basicInfo.status || '-';
        document.getElementById('router3Operator').textContent = router3.basicInfo.operator || '-';

        // 更新最新感知分值显示
        const latestScore = this.getLatestScore('router3');
        const router3ScoreEl = document.getElementById('router3Score');
        if (router3ScoreEl) {
            if (router3.scoreHistory && router3.scoreHistory.length > 0) {
                router3ScoreEl.textContent = latestScore;
                router3ScoreEl.style.color = this.getScoreColor(latestScore);
            } else {
                router3ScoreEl.textContent = '-';
                router3ScoreEl.style.color = '';
            }
        }

        // 更新3D模型状态显示
        if (this.floorPlan3d) {
            const floorScore = (router3.scoreHistory && router3.scoreHistory.length > 0) ? latestScore : undefined;
            this.floorPlan3d.updateDeviceStatus('路由3', router3.basicInfo.status, floorScore);
        }

        this.updateRouter3TrendChart();
    }

    updateRouter3TrendChart() {
        if (!this.router3TrendChart) return;

        const routerHistory = this.data.router3?.scoreHistory || [];
        const labels = routerHistory.map(h => this.formatTime(h.record_time));

        let metricData;
        switch (this.router3CurrentMetric) {
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

        // 为每个数据点设置颜色
        const coloredData = metricData.map(score => ({
            value: score,
            itemStyle: {
                color: this.getScoreColor(score)
            }
        }));

        this.router3TrendChart.setOption({
            xAxis: { data: labels },
            series: [
                { 
                    type: 'bar',
                    data: coloredData
                }
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

        // 为每个数据点设置颜色
        const coloredData = metricData.map(score => ({
            value: score,
            itemStyle: {
                color: this.getScoreColor(score)
            }
        }));

        this.ontTrendChart.setOption({
            xAxis: { data: labels },
            series: [
                { 
                    type: 'bar',
                    data: coloredData
                }
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

        document.querySelectorAll('#router3Card .router-selector .inline-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#router3Card .router-selector .inline-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.router3CurrentMetric = e.target.dataset.metric;
                this.updateRouter3TrendChart();
            });
        });

        // 感知路由标识码编辑
        this.initRouterCodeEditor('router1');
        this.initRouterCodeEditor('router2');
        this.initRouterCodeEditor('router3');

        // 设备信息弹窗事件绑定
        this.initDeviceModal();
    }

    // ===== 设备信息弹窗 =====
    initDeviceModal() {
        const overlay = document.getElementById('deviceModalOverlay');
        const closeBtn = document.getElementById('deviceModalClose');
        if (!overlay || !closeBtn) return;

        // 点击关闭按钮
        closeBtn.addEventListener('click', () => this.hideDeviceModal());

        // 点击遮罩区域关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hideDeviceModal();
        });

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('visible')) {
                this.hideDeviceModal();
            }
        });
    }

    // 显示设备弹窗：光猫只读，路由可切换标识码
    showDeviceModal(name, type) {
        const overlay = document.getElementById('deviceModalOverlay');
        const titleEl = document.getElementById('deviceModalTitle');
        const iconEl = document.getElementById('deviceModalIcon');
        const bodyEl = document.getElementById('deviceModalBody');
        if (!overlay || !titleEl || !bodyEl) return;

        if (type === 'ont') {
            titleEl.textContent = '光猫信息';
            iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><path d="M2 10h2M20 10h2M6 18v2M18 18v2"/></svg>';
            bodyEl.innerHTML = this.buildOntModalBody();
            // 延迟初始化图表，确保 DOM 已渲染
            setTimeout(() => {
                this.initModalOntCharts();
            }, 100);
        } else if (type === 'router') {
            const routerKey = this.nameToRouterKey(name);
            titleEl.textContent = `${name} 信息`;
            iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
            bodyEl.innerHTML = this.buildRouterModalBody(routerKey);
            this.bindModalCodeSwitch(bodyEl, routerKey);
        }

        overlay.classList.add('visible');
    }

    // 更新所有路由卡片的标识码显示（从 localStorage 同步）
    updateRouterCodeDisplays() {
        ['router1', 'router2', 'router3'].forEach(routerKey => {
            const code = this.routerCodes[routerKey];
            const codeEl = document.getElementById(`${routerKey}Code`);
            if (codeEl && code) {
                codeEl.textContent = code;
            }
        });
    }

    // 绑定弹窗内标识码切换按钮（独立函数，便于刷新后重新绑定）
    bindModalCodeSwitch(bodyEl, routerKey) {
        // 切换标识码按钮
        const switchBtn = bodyEl.querySelector('#modalCodeSelect + .modal-code-btn');
        const codeSelect = bodyEl.querySelector('#modalCodeSelect');
        
        // 新增标识码按钮
        const addBtn = bodyEl.querySelector('#modalAddCodeBtn');
        const newCodeInput = bodyEl.querySelector('#modalNewCodeInput');

        // 切换标识码
        const onSwitch = async () => {
            const newCode = codeSelect.value;
            if (!newCode) {
                this.showModalHint(bodyEl, '请选择标识码', true);
                return;
            }
            if (newCode === this.routerCodes[routerKey]) {
                this.showModalHint(bodyEl, '标识码未变更');
                return;
            }
            switchBtn.disabled = true;
            switchBtn.textContent = '切换中...';
            // 切换前保留新旧标识码到历史记录，避免之前的标识码丢失
            this.saveCodeToHistory(routerKey, this.routerCodes[routerKey]);
            this.saveCodeToHistory(routerKey, newCode);
            this.routerCodes[routerKey] = newCode;
            this.saveConfig(`${routerKey}Code`, newCode);

            // 同步更新左侧卡片显示的标识码
            const codeTextEl = document.getElementById(`${routerKey}Code`);
            if (codeTextEl) codeTextEl.textContent = newCode;

            // 重新拉取该路由数据
            await this.fetchRouterData(routerKey);

            // 刷新弹窗内容并重新绑定
            bodyEl.innerHTML = this.buildRouterModalBody(routerKey);
            this.bindModalCodeSwitch(bodyEl, routerKey);
            this.showModalHint(bodyEl, `标识码已切换为 ${newCode}，数据已刷新`);
        };

        // 新增标识码
        const onAdd = async () => {
            const newCode = newCodeInput.value.trim().toUpperCase();
            if (!newCode) {
                this.showModalHint(bodyEl, '请输入标识码', true);
                return;
            }

            // 切换前保留新旧标识码到历史记录，避免之前的标识码丢失
            this.saveCodeToHistory(routerKey, this.routerCodes[routerKey]);
            this.saveCodeToHistory(routerKey, newCode);

            // 切换到新标识码
            this.routerCodes[routerKey] = newCode;
            this.saveConfig(`${routerKey}Code`, newCode);

            // 同步更新左侧卡片显示的标识码
            const codeTextEl = document.getElementById(`${routerKey}Code`);
            if (codeTextEl) codeTextEl.textContent = newCode;

            // 重新拉取该路由数据
            await this.fetchRouterData(routerKey);

            // 刷新弹窗内容并重新绑定
            bodyEl.innerHTML = this.buildRouterModalBody(routerKey);
            this.bindModalCodeSwitch(bodyEl, routerKey);
            this.showModalHint(bodyEl, `已新增并切换到 ${newCode}`);
        };

        if (switchBtn) switchBtn.addEventListener('click', onSwitch);
        if (addBtn) addBtn.addEventListener('click', onAdd);
        if (newCodeInput) {
            newCodeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') onAdd();
            });
        }
    }

    hideDeviceModal() {
        const overlay = document.getElementById('deviceModalOverlay');
        if (overlay) overlay.classList.remove('visible');
        // 销毁弹窗中的图表实例
        if (this.modalCommunityCompareChart) {
            this.modalCommunityCompareChart.dispose();
            this.modalCommunityCompareChart = null;
        }
        if (this.modalOntTrendChart) {
            this.modalOntTrendChart.dispose();
            this.modalOntTrendChart = null;
        }
    }

    // 初始化光猫弹窗中的图表
    initModalOntCharts() {
        this.initModalCommunityCompareChart();
        this.initModalOntTrendChart();
        this.bindModalTrendSelector();
    }

    // 初始化弹窗中的小区对比图
    initModalCommunityCompareChart() {
        const chartDom = document.getElementById('modalCommunityCompareChart');
        if (!chartDom || typeof echarts === 'undefined') return;

        if (this.modalCommunityCompareChart) {
            this.modalCommunityCompareChart.dispose();
        }

        this.modalCommunityCompareChart = echarts.init(chartDom);
        this.updateModalCommunityCompareChart();
    }

    // 更新弹窗中的小区对比图
    updateModalCommunityCompareChart() {
        if (!this.modalCommunityCompareChart) return;

        const ontScore = this.data.ont?.score?.total_score;
        const communityScore = this.data.ont?.communityScore;

        const ontValue = typeof ontScore === 'number' ? ontScore : 0;
        const communityValue = typeof communityScore === 'number' ? communityScore : 0;

        const option = {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(10, 20, 40, 0.9)',
                borderColor: 'rgba(0, 200, 255, 0.3)',
                textStyle: { color: '#eaf4ff', fontSize: 12 }
            },
            grid: {
                left: '10%',
                right: '10%',
                top: '15%',
                bottom: '15%'
            },
            xAxis: {
                type: 'category',
                data: ['光猫', '小区平均'],
                axisLine: { lineStyle: { color: 'rgba(0, 200, 255, 0.2)' } },
                axisLabel: { color: 'rgba(180, 200, 230, 0.7)', fontSize: 11 }
            },
            yAxis: {
                type: 'value',
                max: 100,
                axisLine: { show: false },
                splitLine: { lineStyle: { color: 'rgba(0, 200, 255, 0.08)' } },
                axisLabel: { color: 'rgba(180, 200, 230, 0.5)', fontSize: 10 }
            },
            series: [{
                type: 'bar',
                data: [
                    {
                        value: ontValue,
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: '#00c8ff' },
                                { offset: 1, color: '#0088aa' }
                            ])
                        }
                    },
                    {
                        value: communityValue,
                        itemStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: '#7b2cbf' },
                                { offset: 1, color: '#5a1a8f' }
                            ])
                        }
                    }
                ],
                barWidth: '40%',
                label: {
                    show: true,
                    position: 'top',
                    color: '#eaf4ff',
                    fontSize: 12,
                    fontWeight: 'bold'
                }
            }]
        };

        this.modalCommunityCompareChart.setOption(option);
    }

    // 初始化弹窗中的光猫趋势图
    initModalOntTrendChart() {
        const chartDom = document.getElementById('modalOntTrendChart');
        if (!chartDom || typeof echarts === 'undefined') return;

        if (this.modalOntTrendChart) {
            this.modalOntTrendChart.dispose();
        }

        this.modalOntTrendChart = echarts.init(chartDom);
        this.modalOntCurrentMetric = 'web';
        this.updateModalOntTrendChart();
    }

    // 更新弹窗中的光猫趋势图
    updateModalOntTrendChart() {
        if (!this.modalOntTrendChart) return;

        const ontHistory = this.data.ont?.scoreHistory || [];
        const labels = ontHistory.map(h => h.record_time);

        let metricData;
        switch (this.modalOntCurrentMetric) {
            case 'video':
                metricData = ontHistory.map(h => h.video_score);
                break;
            case 'game':
                metricData = ontHistory.map(h => h.game_score);
                break;
            case 'download':
                metricData = ontHistory.map(h => h.ping_score);
                break;
            default:
                metricData = ontHistory.map(h => h.web_score);
        }

        const option = {
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(10, 20, 40, 0.9)',
                borderColor: 'rgba(0, 200, 255, 0.3)',
                textStyle: { color: '#eaf4ff', fontSize: 12 }
            },
            grid: {
                left: '10%',
                right: '5%',
                top: '10%',
                bottom: '15%'
            },
            xAxis: {
                type: 'category',
                data: labels,
                axisLine: { lineStyle: { color: 'rgba(0, 200, 255, 0.2)' } },
                axisLabel: { color: 'rgba(180, 200, 230, 0.7)', fontSize: 10 }
            },
            yAxis: {
                type: 'value',
                max: 100,
                axisLine: { show: false },
                splitLine: { lineStyle: { color: 'rgba(0, 200, 255, 0.08)' } },
                axisLabel: { color: 'rgba(180, 200, 230, 0.5)', fontSize: 10 }
            },
            series: [{
                type: 'line',
                data: metricData,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: {
                    color: '#00c8ff',
                    width: 2
                },
                itemStyle: {
                    color: '#00c8ff',
                    borderWidth: 2
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(0, 200, 255, 0.3)' },
                        { offset: 1, color: 'rgba(0, 200, 255, 0.05)' }
                    ])
                }
            }]
        };

        this.modalOntTrendChart.setOption(option);
    }

    // 绑定弹窗趋势图选择器
    bindModalTrendSelector() {
        const bodyEl = document.getElementById('deviceModalBody');
        if (!bodyEl) return;

        const buttons = bodyEl.querySelectorAll('.modal-trend-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                buttons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.modalOntCurrentMetric = e.target.dataset.metric;
                this.updateModalOntTrendChart();
            });
        });
    }

    // 在弹窗内显示提示文本
    showModalHint(bodyEl, text, isWarn = false) {
        let hint = bodyEl.querySelector('.modal-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'modal-hint';
            bodyEl.appendChild(hint);
        }
        hint.className = isWarn ? 'modal-hint warn' : 'modal-hint';
        hint.textContent = text;
    }

    // 设备名称映射到 routerKey（路由1/2/3 → router1/2/3）
    nameToRouterKey(name) {
        const map = { '路由1': 'router1', '路由2': 'router2', '路由3': 'router3' };
        return map[name] || 'router1';
    }

    // 构建光猫信息内容（只读）
    buildOntModalBody() {
        const ont = this.data.ont;
        if (!ont || !ont.basicInfo) {
            return '<div class="modal-empty">暂无光猫数据，请等待数据加载...</div>';
        }

        const score = ont.score || {};
        const rows = [
            ['设备类型', '光猫（ONT）'],
            ['宽带账号', this.maskAccount(ont.basicInfo.account) || '-'],
            ['设备厂家', ont.basicInfo.vendor || '-'],
            ['设备型号', ont.basicInfo.model || '-'],
            ['签约带宽', ont.basicInfo.bandwidth ? `${ont.basicInfo.bandwidth} Mbps` : '-'],
            ['所属小区', ont.basicInfo.community || '-']
        ];

        const scoreRows = [
            ['总评分', score.total_score ?? '-'],
            ['网页评分', score.web_score ?? '-'],
            ['视频评分', score.video_score ?? '-'],
            ['PING评分', score.ping_score ?? '-'],
            ['游戏评分', score.game_score ?? '-'],
            ['小区平均评分', ont.communityScore ?? '-']
        ];

        return `
            <div class="modal-content-wrapper">
                <div class="modal-left-section">
                    <div class="modal-section-title">基础信息</div>
                    ${rows.map(([k, v]) => `
                        <div class="modal-info-row">
                            <span class="modal-info-label">${k}</span>
                            <span class="modal-info-value">${v}</span>
                        </div>
                    `).join('')}
                    <div class="modal-section-title">感知评分</div>
                    ${scoreRows.map(([k, v]) => `
                        <div class="modal-info-row">
                            <span class="modal-info-label">${k}</span>
                            <span class="modal-info-value">${v}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-right-section">
                    <div class="modal-chart-section">
                        <div class="modal-section-title">小区对比</div>
                        <div class="modal-chart" id="modalCommunityCompareChart"></div>
                    </div>
                    <div class="modal-chart-section">
                        <div class="modal-section-title">
                            感知趋势
                            <div class="modal-trend-selector">
                                <button class="modal-trend-btn active" data-metric="web">网页</button>
                                <button class="modal-trend-btn" data-metric="video">视频</button>
                                <button class="modal-trend-btn" data-metric="game">游戏</button>
                                <button class="modal-trend-btn" data-metric="download">下载</button>
                            </div>
                        </div>
                        <div class="modal-chart" id="modalOntTrendChart"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // 构建路由信息内容（含标识码切换）
    buildRouterModalBody(routerKey) {
        const data = this.data[routerKey];
        const code = this.routerCodes[routerKey];
        const codeHistory = this.getCodeHistory(routerKey);

        const rows = [
            ['设备类型', '感知路由'],
            ['当前标识码', code || '-'],
            ['在线状态', data?.basicInfo?.status || '-'],
            ['运营商信息', data?.basicInfo?.operator || '-']
        ];

        let latestScore = '-';
        if (data?.scoreHistory && data.scoreHistory.length > 0) {
            const latest = data.scoreHistory[data.scoreHistory.length - 1];
            latestScore = latest.web_score ?? latest.video_score ?? latest.game_score ?? latest.download_score ?? '-';
        }

        // 构建下拉选项
        const optionsHtml = codeHistory.map(c => 
            `<option value="${c}" ${c === code ? 'selected' : ''}>${c}${c === code ? ' (当前)' : ''}</option>`
        ).join('');

        return `
            <div class="modal-section-title">设备信息</div>
            ${rows.map(([k, v]) => {
                const isStatus = k === '在线状态';
                const cls = isStatus ? (v === '在线' ? 'online' : (v === '离线' ? 'offline' : '')) : '';
                return `
                <div class="modal-info-row">
                    <span class="modal-info-label">${k}</span>
                    <span class="modal-info-value ${cls}">${v}</span>
                </div>`;
            }).join('')}
            <div class="modal-info-row">
                <span class="modal-info-label">最新感知评分</span>
                <span class="modal-info-value">${latestScore}</span>
            </div>

            <div class="modal-code-section">
                <label class="modal-code-label">选择标识码</label>
                <div class="modal-code-input-row">
                    <select class="modal-code-select" id="modalCodeSelect">
                        ${optionsHtml}
                    </select>
                    <button class="modal-code-btn">切换</button>
                </div>
                <div class="modal-code-input-row" style="margin-top: 10px;">
                    <input type="text" class="modal-code-input" id="modalNewCodeInput" maxlength="20" placeholder="新增标识码">
                    <button class="modal-code-btn" id="modalAddCodeBtn">新增</button>
                </div>
                <div class="modal-hint">切换后将重新拉取该路由的感知数据。</div>
            </div>
        `;
    }

    // 获取标识码历史记录
    getCodeHistory(routerKey) {
        try {
            const key = `network_monitor_${routerKey}CodeHistory`;
            const history = localStorage.getItem(key);
            let result = history ? JSON.parse(history) : [];

            // 始终确保当前标识码在历史记录中（防止 localStorage 残缺丢失当前码）
            const currentCode = this.routerCodes[routerKey];
            if (currentCode && !result.includes(currentCode)) {
                result.unshift(currentCode);
            }

            // 预设标识码列表，确保始终包含
            const presets = {
                router2: ['PKKQGW'],
                router3: ['PKKQRW']
            };

            if (presets[routerKey]) {
                presets[routerKey].forEach(code => {
                    if (!result.includes(code)) {
                        result.push(code);
                    }
                });
            }

            return result;
        } catch (e) {
            return [this.routerCodes[routerKey]];
        }
    }

    // 保存标识码到历史记录
    saveCodeToHistory(routerKey, code) {
        try {
            const key = `network_monitor_${routerKey}CodeHistory`;
            let history = this.getCodeHistory(routerKey);
            if (!history.includes(code)) {
                history.push(code);
            }
            // 始终持久化，确保内存回退的当前码也写入 localStorage，避免切换后丢失
            localStorage.setItem(key, JSON.stringify(history));
        } catch (e) {
            console.warn('保存标识码历史失败:', e);
        }
    }

    // 从历史记录中删除标识码
    removeCodeFromHistory(routerKey, code) {
        try {
            const key = `network_monitor_${routerKey}CodeHistory`;
            let history = this.getCodeHistory(routerKey);
            history = history.filter(c => c !== code);
            if (history.length === 0) {
                // 至少保留一个
                history.push(this.routerCodes[routerKey]);
            }
            localStorage.setItem(key, JSON.stringify(history));
        } catch (e) {
            console.warn('删除标识码历史失败:', e);
        }
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
            // 切换前保留新旧标识码到历史记录，避免之前的标识码丢失
            this.saveCodeToHistory(routerKey, this.routerCodes[routerKey]);
            this.saveCodeToHistory(routerKey, newCode);
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
        if (this.router3TrendChart) this.router3TrendChart.resize();
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