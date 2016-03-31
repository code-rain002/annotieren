import React from 'react'
import ReactDOM from 'react-dom'
import Route from 'react-route'
import injectTapEventPlugin from 'react-tap-event-plugin'
injectTapEventPlugin()

import Navigation from './navigation'
import Register from './register'
import Search from './search'
import SearchResults from './search_results'
import DocView from './doc_view'
import PaperView from './paper_view'


class Main extends React.Component {
  constructor(props) {
    super(props)
    this.state = {searchQuery: ""}
  }

  search(query) {
    this.setState({
      searchQuery: query
    })
  }

  render() {
    return (
      <div>
        <div>
          <Route path="/">
            <Navigation for="/"/>

            <Search/>
            <SearchResults/>
          </Route>
          <Route path="/register">
            <Navigation/>

            <Register/>
          </Route>
          <Route path="/file/:id">
            <FileRoute/>
          </Route>
          <Route path="/paper/:id">
            <PaperRoute/>
          </Route>
        </div>
      </div>
    )
  }
}

class FileRoute extends React.Component {
  render() {
    let id = this.props.params.id
    return (
      <div>
        <Navigation/>

        <DocView key={id} id={id}/>
      </div>
    )
  }
}

class PaperRoute extends React.Component {
  render() {
    let id = this.props.params.id
    return (
      <div>
        <Navigation/>

        <PaperView key={id} id={id}/>
      </div>
    )
  }
}

ReactDOM.render(<Main />, document.getElementById('app-container'))
