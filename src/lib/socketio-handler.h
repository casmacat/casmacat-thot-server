/*
 *   Copyright 2012, valabau
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * 
 * socketio-handler.h
 *
 *  Created on: 26/03/2012
 *      Author: valabau
 */

#ifndef CasMaCat_SOCKETIO_HANDLER_H_
#define CasMaCat_SOCKETIO_HANDLER_H_


// com.zaphoyd.websocketpp.chat protocol
//
// client messages:
// alias [UTF8 text, 16 characters max]
// msg [UTF8 text]
//
// server messages:
// {"type":"msg","sender":"<sender>","value":"<msg>" }
// {"type":"participants","value":[<participant>,...]}

#include <websocketpp/websocketpp.hpp>

#include <map>
#include <string>
#include <vector>

using websocketpp::server;

namespace casmacat {

class socketio_server_handler: public server::handler {
public:
    socketio_server_handler(const std::string &name): server::handler(), resource_name_(name) {}

    void validate(connection_ptr con);

    // add new connection to the lobby
    void on_open(connection_ptr con);

    // someone disconnected from the lobby, remove them
    void on_close(connection_ptr con);

    void on_message(connection_ptr con, message_ptr msg);
private:
    std::string serialize_state();
    std::string encode_message(std::string sender,std::string msg,bool escape = true);
    std::string get_con_id(connection_ptr con);

    // list of outstanding connections
    std::map<connection_ptr, std::string> connections_;
    std::string resource_name_;
};

typedef boost::shared_ptr<socketio_server_handler> socketio_server_handler_ptr;

}


#endif /* CasMaCat_SOCKETIO_HANDLER_H_ */
