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
 * echo-server.cpp
 *
 *  Created on: 26/03/2012
 *      Author: valabau
 */


#include <websocketpp/websocketpp.hpp>
#include <boost/asio.hpp>
#include <casmacat/compat.h>
#include <iostream>

using namespace casmacat;
using websocketpp::server;

int main(int argc, char* argv[]) {
    short port = 9003;

    if (argc == 2) {
        // TODO: input validation?
        port = atoi(argv[1]);
    }

    try {
        // create an instance of our handler
        server::handler::ptr handler; //(new socketio_server_handler("/echo"));

        // create a server that listens on port `port` and uses our handler
        server endpoint(handler);

        endpoint.alog().set_level(websocketpp::log::alevel::CONNECT);
        endpoint.alog().set_level(websocketpp::log::alevel::DISCONNECT);

        endpoint.elog().set_level(websocketpp::log::elevel::RERROR);
        endpoint.elog().set_level(websocketpp::log::elevel::FATAL);

        // setup server settings
        // Casmacat server should only be receiving small text messages, reduce max
        // message size limit slightly to save memory, improve performance, and
        // guard against DoS attacks.
        //server->set_max_message_size(0xFFFF); // 64KiB

        std::cout << "Starting echo server on port " << port << std::endl;

        endpoint.listen(port);
    } catch (std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
    }

    return 0;
}
