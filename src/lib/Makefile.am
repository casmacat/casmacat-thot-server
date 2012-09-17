#######################################
# The list of libraries we are building seperated by spaces.
# The 'lib_' indicates that these build products will be installed
# in the $(libdir) directory. For example /usr/lib
lib_LTLIBRARIES = libcasmacat.la

#######################################
# Build information for each library

# Sources for casmacat
libcasmacat_la_SOURCES = socketio-handler.cpp

# Linker options 
libcasmacat_la_LDFLAGS = -lboost_system -lboost_date_time -lboost_regex -lboost_program_options -lboost_thread -lwebsocketpp -ljson

# Compiler options. Here we are adding the include directory
# to be searched for headers included in the source code.
libcasmacat_la_CPPFLAGS = -I$(top_srcdir)/src/include

