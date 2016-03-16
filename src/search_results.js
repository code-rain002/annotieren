import React from 'react'
import Reflux from 'reflux'
import Route from 'react-route'

import Card from 'material-ui/lib/card/card'
import CardActions from 'material-ui/lib/card/card-actions'
import CardHeader from 'material-ui/lib/card/card-header'
import CardMedia from 'material-ui/lib/card/card-media'
import CardTitle from 'material-ui/lib/card/card-title'
import CardText from 'material-ui/lib/card/card-text'
import List from 'material-ui/lib/lists/list'
import ListItem from 'material-ui/lib/lists/list-item'
import colors from 'material-ui/lib/styles/colors'
import DescriptionIcon from 'material-ui/lib/svg-icons/action/description'
import RaisedButton from 'material-ui/lib/raised-button'
import FlatButton from 'material-ui/lib/flat-button'
import Avatar from 'material-ui/lib/avatar'
import ActionDescription from 'material-ui/lib/svg-icons/action/description'
import CircularProgress from 'material-ui/lib/circular-progress'


import { actions as searchActions } from './search_store'


const TYPE_MEETING = "https://oparl.org/schema/1.0/Meeting"
const TYPE_PAPER = "https://oparl.org/schema/1.0/Paper"
const TYPE_FILE = "https://oparl.org/schema/1.0/File"


export default React.createClass({
  mixins: [
    Reflux.listenTo(searchActions.search, "onSearch"),
    Reflux.listenTo(searchActions.search.completed, "onSearchCompleted"),
    Reflux.listenTo(searchActions.search.failed, "onSearchFailed")
  ],

  getInitialState: function() {
    return {
      results: []
    }
  },

  componentDidMount: function() {
    // Start an empty search on startup
    searchActions.search("")
  },

  onSearch: function() {
    this.setState({
      loading: true
    })
  },

  onSearchFailed: function() {
    this.setState({
      loading: false
    })
  },

  onSearchCompleted: function(results) {
    this.setState({
      loading: false,
      results: results
    })
  },

  render: function() {
    return (
      <div style={{ maxWidth: "60em", margin: "0 auto" }}>
        {this.state.loading ?
          <CircularProgress size={2}/> :
          this.state.results.map((result, i) =>
            <SearchResult key={i} {...result}/>
          )}
      </div>
    )
  },
})

class SearchResult extends React.Component {
  render() {
    switch(this.props.type) {
    case TYPE_MEETING:
      return <Meeting {...this.props}/>
      break
    case TYPE_PAPER:
      return <Paper {...this.props}/>
      break
    case TYPE_FILE:
      return <File {...this.props}/>
      break
    default:
      return <p/>
    }
  }
}

class Meeting extends React.Component {
  render() {
    return (
      <Card style={{ marginBottom: "1em" }}>
        <CardHeader
            title={this.props.name}
            subtitle={`${this.props.shortName} ${this.props.start}`}
            style={{ backgroundColor: colors.lime500 }}
            />
        <CardText>
          {findFilesInObject(this.props).map(id =>
            <FileItem key={id} id={id}/>
          )}
          <List>
            {this.props.agendaItem ?
              this.props.agendaItem.map((item, i) =>
                <ListItem
                    key={i}
                    disabled={!item.consultation}
                    innerDivStyle={{ paddingRight: "0" }}
                    leftIcon={(item.number && item.number.length <= 2) ?
                      <Avatar size={24}>{item.number}</Avatar> :
                      <span>{item.number}</span>
                    }>
                  <div>
                    {item.name}
                  </div>
                  {(findFilesInObject(item).length > 0) ? (
                    <List>
                      {findFilesInObject(item).map(id =>
                        <FileItem key={id} id={id}/>
                      )}
                    </List>
                  ) : ""}
                </ListItem>
              ) : ""}
          </List>
        </CardText>
      </Card>
    )
  }
}

class Paper extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      meetings: []
    }
  }

  render() {
    let paper = this.props

    return (
      <Card style={{ marginBottom: "1em" }}>
        <CardHeader
            avatar={<Avatar title={paper.shortName} size={32}
                        backgroundColor={paperShortNameToColor(paper.shortName)}
                   >
                {paper.shortName[0]}
              </Avatar>}
            title={paper.name}
            titleStyle={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              // Vorlagen names tend to get really long, though
              // they're included in the @title in full
              maxWidth: '56em'
            }}
            subtitle={`${paper.shortName} ${iso8601ToDate(paper.publishedDate)}`}
            style={{ backgroundColor: colors.lime700 }}
            />
        <CardText>
          {findFilesInObject(paper).map(id =>
            <FileItem key={id} id={id}/>
          )}
          <List>
            {(paper.consultation || [])
              .filter(consultation => !!consultation.meeting)
              .map((consultation, i) =>
                <MeetingItem key={i} id={consultation.meeting} filesOf={paper.id}/>
            )}
          </List>
        </CardText>
        <CardActions style={{ textAlign: 'right' }}>
          <RaisedButton label="Vorlage lesen" primary={true}/>
        </CardActions>
      </Card>
    )
  }
}

class File extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      meetings: [],
      papers: []
    }
  }

  componentDidMount() {
    fetch(`/api/oparl/file/${encodeURIComponent(this.props.id)}/context`)
      .then(res => res.json())
      .then(results => {
        let meetings = []
        let papers = []
        for(let result of results) {
          if (result.type == TYPE_MEETING) {
            meetings.push(result)
          } else if (result.type == TYPE_PAPER) {
            papers.push(result)
          }
        }
        this.setState({
          meetings: meetings,
          papers: papers
        })
      })
  }

  render() {
    return (
      <Card style={{ marginBottom: "1em" }}>
        <CardHeader
            title={<span><Avatar backgroundColor="white" size={36}><ActionDescription/></Avatar> {this.props.name}</span>}
            style={{ backgroundColor: colors.lime300 }}
            />
        <CardText>
          <List>
            {this.state.meetings.map(meeting =>
              <MeetingItem {...meeting}/>
            )}
            {this.state.papers.map(paper =>
              <PaperItem {...paper}/>
            )}
          </List>
        </CardText>
        <CardActions style={{ textAlign: 'right' }}>
          <RaisedButton label="Text Annotieren" primary={true}
              style={{ verticalAlign: 'top' }}
              onClick={ev => Route.go(`/file/${this.props.id}`)}
              />
          <RaisedButton label="Original-PDF" secondary={true}
              linkButton={true} href={this.props.downloadUrl}
              />
        </CardActions>
      </Card>
    )
  }
}

class MeetingItem extends React.Component {
  componentDidMount() {
    if (!this.props.name) {
      fetch(`/api/oparl/meeting/${encodeURIComponent(this.props.id)}`)
        .then(res => res.json())
        .then(result => {
          this.setState(result)
        })
    }
  }

  render() {
    let meeting = this.state || this.props

    return !this.props.filesOf ?
      <ListItem disabled={true}
          primaryText={meeting.name}
          secondaryText={iso8601ToDate(meeting.start)}
          >
      </ListItem> :
      <ListItem disabled={true} innerDivStyle={{ paddingRight: "0" }}>
        <List subheader={meeting.name}>
          {findFilesInObject(meeting).map(id =>
            <FileItem key={id} id={id}/>
          )}
          {meeting.agendaItem ?
            <ListItem innerDivStyle={{ paddingRight: "0" }}>
              {meeting.agendaItem
                .filter(item =>
                  item.consultation &&
                  item.consultation.parentID === this.props.filesOf
                )
                .map((item, i) =>
                  <List key={i} subheader={item.name}>
                    {findFilesInObject(item).map(id =>
                      <FileItem key={id} id={id}/>
                    )}
                  </List>
                )}
            </ListItem> : ""
          }
        </List>
      </ListItem>
  }
}

class PaperItem extends React.Component {
  componentDidMount() {
    if (!this.props.name) {
      fetch(`/api/oparl/paper/${encodeURIComponent(this.props.id)}`)
        .then(res => res.json())
        .then(result => {
          this.setState(result)
        })
    }
  }

  render() {
    let paper = this.state || this.props

    return <ListItem
        leftIcon={
          <Avatar title={paper.shortName} size={32} color="white"
              backgroundColor={paperShortNameToColor(paper.shortName)}
              >
            {paper.shortName[0]}
          </Avatar>
        }
        primaryText={paper.name}
        secondaryText={iso8601ToDate(paper.publishedDate)}
        />
  }
}

class FileItem extends React.Component {
  componentDidMount() {
    if (!this.props.name) {
      fetch(`/api/oparl/file/${encodeURIComponent(this.props.id)}`)
        .then(res => res.json())
        .then(result => {
          this.setState(result)
        })
    }
  }

  render() {
    let file = this.state || this.props

    return (
      <ListItem
          innerDivStyle={{ paddingRight: "0" }}
          primaryText={file.name}
          leftIcon={<ActionDescription/>}
          onClick={ev => Route.go(`/file/${this.props.id}`)}
          />
    )
  }

  handleClickAnnotate(ev) {
    ev.preventDefault()

    Route.go(`/file/${this.props.id}`)
  }
}

const FILES_KEYS = [
  'invitation',
  'masterFile',
  'mainFile',
  'derivativeFile',
  'verbatimProtocol',
  'resultsProtocol',
  'resolutionFile',
  'auxiliaryFile'
]

function findFilesInObject(obj) {
  let results = []
  for(let k of FILES_KEYS) {
    let v = obj[k]
    if (typeof v == 'string') {
      results.push(v)
    } else if (v) {
      results.push(...v)
    }
  }
  return results
}

function iso8601ToDate(iso8601) {
  let m
  if (iso8601 && (m = iso8601.match(/(\d{4})-(\d\d)-(\d\d)/))) {
    return `${m[3]}.${m[2]}.${m[1]}`
  } else {
    return "?"
  }
}

function paperShortNameToColor(id) {
  if (/^V/.test(id)) {
    return colors.deepPurple500
  } else if (/^A/.test(id)) {
    return colors.lightBlue500
  } else if (id) {
    return colors.lightGreen500
  } else {
    return colors.lightGreen200
  }
}
