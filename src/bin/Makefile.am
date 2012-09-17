

#######################################
# The list of executables we are building seperated by spaces
# the 'bin_' indicates that these build products will be installed
# in the $(bindir) directory. For example /usr/bin
#bin_PROGRAMS=exampleProgram

# Because a.out is only a sample program we don't want it to be installed.
# The 'noinst_' prefix indicates that the following targets are not to be
# installed.
bin_PROGRAMS=casmacat-translate casmacat-align casmacat-estimate-confidences casmacat-imt
#noinst_PROGRAMS=echo_server
LDADD= -lltdl

#######################################
# Build information for each executable. The variable name is derived
# by use the name of the executable with each non alpha-numeric character is
# replaced by '_'. So a.out becomes a_out and the appropriate suffex added.
# '_SOURCES' for example.

#echo_server_SOURCES= echo-server.cpp
#echo_server_LDFLAGS = $(top_srcdir)/src/lib/libcasmacat.la 
#echo_server_CPPFLAGS = -I$(top_srcdir)/src/include

###### translate
casmacat_translate_SOURCES= translate.cpp
casmacat_translate_LDFLAGS = $(top_srcdir)/src/lib/libcasmacat.la 
casmacat_translate_CPPFLAGS = -I$(top_srcdir)/src/include

###### translate imt
casmacat_imt_SOURCES= translate-imt.cpp
casmacat_imt_LDFLAGS = $(top_srcdir)/src/lib/libcasmacat.la 
casmacat_imt_CPPFLAGS = -I$(top_srcdir)/src/include

###### aligner
casmacat_align_SOURCES= align.cpp
casmacat_align_LDFLAGS = $(top_srcdir)/src/lib/libcasmacat.la 
casmacat_align_CPPFLAGS = -I$(top_srcdir)/src/include

###### confidence estimator
casmacat_estimate_confidences_SOURCES= estimate-confidences.cpp
casmacat_estimate_confidences_LDFLAGS = $(top_srcdir)/src/lib/libcasmacat.la 
casmacat_estimate_confidences_CPPFLAGS = -I$(top_srcdir)/src/include

