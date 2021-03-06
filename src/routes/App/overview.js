import React, { PureComponent, Fragment } from "react";
import PropTypes from "prop-types";
import { connect } from "dva";
import { Button, notification } from "antd";
import appAcionLogUtil from "../../utils/app-action-log-util";
import dateUtil from "../../utils/date-util";
import { getActionLogDetail } from "../../services/app";
import LogSocket from "../../utils/logSocket";
import BuildHistory from "./component/BuildHistory/index";
import Basic from "./component/Basic/index";
import OperationRecord from "./component/Basic/operationRecord";
import Instance from "./component/Instance/index";
import LogProcress from "../../components/LogProcress";
import styles from "./Index.less";
import globalUtil from "../../utils/global";
import userUtil from "../../utils/user";
import teamUtil from "../../utils/team";
import regionUtil from "../../utils/region";

const ButtonGroup = Button.Group;

@connect(({ user, appControl }) => ({
  currUser: user.currentUser,
  appDetail: appControl.appDetail
}))
class LogItem extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      status: "",
      resultStatus: "",
      opened: false,
      logType: "info",
      logs: [],
      actioning: false
    };
  }
  static contextTypes = {
    isActionIng: PropTypes.func,
    appRolback: PropTypes.func
  };
  showLogType = () => {
    if (this.state.status === "ing") {
      return "none";
    }

    if (this.state.opened === false) {
      return "none";
    }
    return "";
  };

  componentDidMount() {
    const { data } = this.props;
    if (data) {
      if (this.ref) {
        this.ref.querySelector(
          ".actioncn"
        ).innerHTML = appAcionLogUtil.getActionCN(data);
        if (appAcionLogUtil.isSuccess(data)) {
          this.onSuccess();
        }
        if (appAcionLogUtil.isFail(data)) {
          this.onFail(data);
        }
        if (appAcionLogUtil.isTimeout(data)) {
          this.onTimeout(data);
        }
        if (appAcionLogUtil.isActioning(data)) {
          this.setState({ status: "ing", actioning: true });
          this.ref.querySelector(".actionresultcn").innerHTML = "进行中";
          this.context.isActionIng(true);
        }
        this.ref.querySelector(".action-user").innerHTML =
          "@" + appAcionLogUtil.getActionUser(data);
      }
    }
  }

  loadLog() {
    getActionLogDetail({
      app_alias: this.props.appAlias,
      level: this.state.logType,
      team_name: globalUtil.getCurrTeamName(),
      event_id: this.props.data.event_id
    }).then(data => {
      if (data) {
        this.setState({
          logs: data.list || []
        });
      }
    });
  }
  getSocketUrl = () => {
    let currTeam = userUtil.getTeamByTeamName(
      this.props.currUser,
      globalUtil.getCurrTeamName()
    );
    let currRegionName = globalUtil.getCurrRegionName();

    if (currTeam) {
      let region = teamUtil.getRegionByName(currTeam, currRegionName);

      if (region) {
        return regionUtil.getEventWebSocketUrl(region);
      }
    }
    return "";
  };
  createSocket() {
    const { data } = this.props;
    let socketUrls = this.getSocketUrl();
    if (socketUrls) {
      let isThrough = dateUtil.isWebSocketOpen(socketUrls);
      if (isThrough && isThrough === "through") {
        this.socket = new LogSocket({
          url: this.getSocketUrl(),
          eventId: data.event_id,
          onMessage: data => {
            let logs = this.state.logs;
            logs.unshift(data);
            this.setState({
              logs: [].concat(logs)
            });
          }
        });
      }
    }
  }
  onClose = () => {
    this.isDoing = false;
  };
  onSuccess = data => {
    this.setState({ resultStatus: "success" });
    this.ref.querySelector(".actionresultcn").innerHTML = "完成";
  };
  onTimeout = data => {
    this.setState({ resultStatus: "timeout" });
    this.ref.querySelector(".actionresultcn").innerHTML = "超时";

    this.ref.querySelector(".action-error-msg").innerHTML =
      "(" + appAcionLogUtil.getFailMessage(data) + ")";
  };
  onFail = data => {
    this.setState({ resultStatus: "fail" });
    this.ref.querySelector(".actionresultcn").innerHTML = "失败";

    this.ref.querySelector(".action-error-msg").innerHTML =
      "(" + appAcionLogUtil.getFailMessage(data) + ")";
  };
  onComplete = data => {
    this.setState({ status: "" });
    this.context.isActionIng(false);
    this.close();
  };
  getLogContHeight() {
    const { status, opened } = this.state;
    if (status === "ing" && !opened) {
      return 15;
    }

    if (opened) {
      return "auto";
    }

    return 0;
  }
  open = () => {
    this.setState(
      {
        opened: true,
        logType: "info"
      },
      () => {
        this.loadLog();
      }
    );
  };
  close = () => {
    this.setState({ opened: false });
  };
  changeLogType = type => {
    if (type === this.state.logType) {
      return;
    }
    this.setState(
      {
        logType: type,
        logs: []
      },
      () => {
        this.loadLog();
      }
    );
  };
  saveRef = ref => {
    this.ref = ref;
  };
  getResultClass() {
    const { data } = this.props;
    if (this.state.resultStatus === "fail") {
      return styles.fail;
    }

    if (this.state.resultStatus === "success") {
      return styles.success;
    }
    return "";
  }
  handleRollback = () => {
    this.context.appRolback(
      appAcionLogUtil.getRollbackVersion(this.props.data)
    );
  };
  render() {
    const { status, opened, logType, logs } = this.state;
    const { data } = this.props;
    const box = document.getElementById("box");
    if (!data) {
      return null;
    }

    return (
      <div
        ref={this.saveRef}
        className={`${styles.logItem} ${this.getResultClass()}`}
      >
        <div className={styles.logItemDate}>
          <span className={styles.time}>
            {appAcionLogUtil.getActionTime(data)}
          </span>
          <span className={styles.date}>
            {dateUtil.dateToCN(
              appAcionLogUtil.getActionDateTime(data),
              "yyyy-MM-dd"
            )}
          </span>
        </div>
        <div className={styles.logItemMain}>
          <div className={styles.hd}>
            <label className={styles.tit}>
              <span className="actioncn" />
              <span className="actionresultcn" />
              <span className="action-error-msg" />
              <span className="action-user" />
            </label>
            <div className={styles.btns}>
              {!opened ? (
                <span onClick={this.open} className={styles.btn}>
                  查看详情
                </span>
              ) : (
                <span onClick={this.close} className={styles.btn}>
                  收起
                </span>
              )}
            </div>
          </div>
          {appAcionLogUtil.isShowCommitInfo(data) ? (
            <div className={styles.codeVersion}>
              <div className={styles.versionInfo}>
                代码信息： {appAcionLogUtil.getCommitLog(data)}
              </div>
              <div className={styles.versionAuthor}>
                #{appAcionLogUtil.getCodeVersion(data)}
                by {appAcionLogUtil.getCommitUser(data)}
              </div>
            </div>
          ) : (
            ""
          )}

          <ButtonGroup
            style={{
              display: this.showLogType()
            }}
            size="small"
            className={styles.logTypeBtn}
          >
            <Button
              onClick={() => {
                this.changeLogType("info");
              }}
              className={logType === "info" ? "active" : ""}
              type="dashed"
            >
              Info日志
            </Button>
            <Button
              onClick={() => {
                this.changeLogType("debug");
              }}
              className={logType === "debug" ? "active" : ""}
              type="dashed"
            >
              Debug日志
            </Button>
            <Button
              onClick={() => {
                this.changeLogType("error");
              }}
              className={logType === "error" ? "active" : ""}
              type="dashed"
            >
              Error日志
            </Button>
          </ButtonGroup>
          <div
            style={{
              height: this.getLogContHeight(),
              maxHeight: 350,
              overflowY: "auto"
            }}
            className={`${styles.logContent} logs-cont`}
          >
            {/* 动态日志 */}
            {status === "ing" ? (
              <LogProcress
                resover
                onClose={this.onClose}
                onComplete={this.onComplete}
                onSuccess={this.onSuccess}
                onTimeout={this.onTimeout}
                onFail={this.onFail}
                socketUrl={this.getSocketUrl()}
                eventId={data.event_id}
                opened={opened}
                list={this.state.logs}
              />
            ) : (
              <div>
                {logs &&
                  logs.length > 0 &&
                  logs.map((item, index) => (
                    <p key={index}>
                      <span
                        style={{
                          marginRight: 10
                        }}
                      >
                        {dateUtil.format(item.time, "hh:mm:ss")}
                      </span>
                      <span>{item.message}</span>
                    </p>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

class LogList extends PureComponent {
  render() {
    const list = this.props.list;
    return (
      <div className={styles.logs}>
        {list.map(item => (
          <LogItem
            appDetail={this.props.appDetail}
            key={item.event_id}
            appAlias={this.props.appAlias}
            data={item}
          />
        ))}
      </div>
    );
  }
}

@connect(
  ({ user, appControl }) => ({
    currUser: user.currentUser,
    appRequest: appControl.appRequest,
    appRequestRange: appControl.appRequestRange,
    requestTime: appControl.requestTime,
    requestTimeRange: appControl.requestTimeRange,
    appDisk: appControl.appDisk,
    appMemory: appControl.appMemory
  }),
  null,
  null,
  { withRef: true }
)
export default class Index extends PureComponent {
  constructor(arg) {
    super(arg);
    this.state = {
      actionIng: false,
      logList: [],
      recordLoading: true,
      page: 1,
      page_size: 6,
      hasNext: false,
      // 安装的性能分析插件
      anaPlugins: [],
      disk: 0,
      memory: 0,
      showVersionManage: false,
      showUpgrade: false,
      beanData: null,
      dataList: [],
      runLoading: true,
      new_pods: null,
      old_pods: null,
      more: false,
      total: 0,
      current_version: null,
      status: "",
      isopenLog: false,
      buildSource: null
    };
    this.inerval = 5000;
  }
  static contextTypes = {
    isActionIng: PropTypes.func,
    appRolback: PropTypes.func
  };
  componentDidMount() {
    this.mounted = true;
    this.loadBuildSourceInfo();
    this.fetchAppDiskAndMemory();
    this.getVersionList();
    this.fetchOperationLog(true);
    this.fetchPods();
    this.interval = setInterval(() => this.fetchPods(), 5000);
  }
  componentWillUnmount() {
    this.mounted = false;

    clearTimeout(this.cycleevent);
    clearInterval(this.interval);
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.status !== prevState.status) {
      return {
        status: nextProps.status
      };
    }
    return null;
  }
  fetchAppDiskAndMemory() {
    this.props.dispatch({
      type: "appControl/getAppResource",
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        app_alias: this.props.appAlias
      },
      callback: data => {
        if (data && data.bean) {
          this.setState({
            disk: data.bean.disk || 0,
            memory: data.bean.memory || 0
          });
        }
      }
    });
  }

  fetchOperationLog = lool => {
    this.props.dispatch({
      type: "appControl/fetchOperationLog",
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        app_alias: this.props.appAlias,
        target: "service",
        page: this.state.page,
        page_size: this.state.page_size
      },
      callback: res => {
        if (res) {
          this.setState(
            {
              has_next: res.has_next || false,
              logList: res.list || [],
              total: res.bean.total
                ? res.bean.total
                : res.list
                ? res.list.length
                : 0
            },
            () => {
              if (lool) {
                this.cycleevent = setTimeout(() => {
                  this.fetchOperationLog(true);
                }, 5000);
              }
            }
          );
        }
        this.setState({
          recordLoading: false
        });
      }
    });
  };

  handleNextPage = () => {
    this.setState(
      {
        page: 1,
        page_size: this.state.page_size * (this.state.page + 1)
      },
      () => {
        this.fetchOperationLog(false);
      }
    );
  };
  getStartTime() {
    return new Date().getTime() / 1000 - 60 * 60;
  }
  getStep() {
    return 60;
  }
  showVersionManage = () => {
    this.setState({ showVersionManage: true });
  };
  hideVersionManage = () => {
    this.setState({ showVersionManage: false });
  };
  handleRollback = data => {
    this.context.appRolback(data);
  };

  onAction = action => {
    this.fetchOperationLog(false);
    this.getVersionList();
  };
  onLogPush = isopen => {
    this.setState({
      isopenLog: isopen
    });
  };
  onPageChange = page => {};

  handleDel = item => {
    this.props.dispatch({
      type: "appControl/delAppVersion",
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        service_alias: this.props.appAlias,
        version_id: item.build_version
      },
      callback: res => {
        if (res) {
          notification.success({
            message: "删除成功"
          });
          this.getVersionList();
        }
      }
    });
  };

  getVersionList = update => {
    update && this.props.setShowUpgrade();
    this.props.dispatch({
      type: "appControl/getAppVersionList",
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        service_alias: this.props.appAlias,
        page_num: 1,
        page_size: 10
      },
      callback: data => {
        if (data && data.bean && data.list) {
          let beanobj = null;
          data.list &&
            data.list.length > 0 &&
            data.list.map(item => {
              if (item.build_version === data.bean.current_version) {
                beanobj = item;
              }
            });
          this.setState({
            current_version: data.bean.current_version,
            beanData: beanobj,
            dataList: data.list
          });
        }
      }
    });
  };

  loadBuildSourceInfo = () => {
    const { dispatch } = this.props;
    dispatch({
      type: "appControl/getAppBuidSource",
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        service_alias: this.props.appAlias
      },
      callback: data => {
        if (data) {
          this.setState({
            buildSource:
              data.bean && data.bean.service_source && data.bean.service_source
          });
        }
      }
    });
  };

  fetchPods = () => {
    const { appAlias, dispatch } = this.props;
    dispatch({
      type: "appControl/fetchPods",
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        app_alias: appAlias
      },
      callback: data => {
        if (data && data.list) {
          this.setState({
            new_pods: data.list.new_pods,
            old_pods: data.list.old_pods
          });
        }
        this.setState({
          runLoading: false
        });
      }
    });
  };

  handleMore = more => {
    this.setState({
      more
    });
  };

  render() {
    const {
      logList,
      memory,
      beanData,
      dataList,
      new_pods,
      old_pods,
      runLoading,
      more,
      disk,
      buildSource,
      isopenLog,
      recordLoading,
      has_next,
      current_version
    } = this.state;
    const { status } = this.props;
    return (
      <Fragment>
        <Basic
          buildSource={buildSource}
          beanData={beanData}
          memory={memory}
          disk={disk}
          dataList={dataList}
          status={status}
          handleMore={this.handleMore}
          more={more}
          socket={this.props.socket && this.props.socket}
        />
        {more && (
          <BuildHistory
            beanData={beanData}
            current_version={current_version}
            dataList={dataList}
            handleDel={this.handleDel}
            onRollback={this.handleRollback}
            socket={this.props.socket && this.props.socket}
          />
        )}
        {!more && (
          <Instance
            status={status}
            runLoading={runLoading}
            new_pods={new_pods}
            old_pods={old_pods}
            appAlias={this.props.appAlias}
            socket={this.props.socket && this.props.socket}
          />
        )}
        {!more && (
          <OperationRecord
            socket={this.props.socket && this.props.socket}
            isopenLog={isopenLog}
            onLogPush={this.onLogPush}
            has_next={has_next}
            logList={logList}
            recordLoading={recordLoading}
            handleNextPage={this.handleNextPage}
          />
        )}
      </Fragment>
    );
  }
}
